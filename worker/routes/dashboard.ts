import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase';
import type { AppContextEnv } from '../types';
import { ExpenseRow, getTodaySaoPauloISO, mapExpenseRow } from './expenses';

const monthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Formato de mês inválido. Use AAAA-MM.');

function shiftMonth(monthIso: string, deltaMonths: number): string {
  const [y, m] = monthIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export const dashboardRoutes = new Hono<AppContextEnv>();

dashboardRoutes.get('/dashboard', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseClient(c);

  const rawMonth = c.req.query('month');
  const targetMonth = rawMonth ? rawMonth : getTodaySaoPauloISO().slice(0, 7);

  const parsedMonth = monthSchema.safeParse(targetMonth);
  if (!parsedMonth.success) {
    return c.json({ error: parsedMonth.error.issues[0]?.message || 'Mês inválido.' }, 400);
  }

  const month = parsedMonth.data;
  const previousMonth = shiftMonth(month, -1);
  const nextMonth = shiftMonth(month, 1);

  const monthStart = `${month}-01`;
  const nextMonthStart = `${nextMonth}-01`;
  const prevMonthStart = `${previousMonth}-01`;

  const [categoriesRes, periodExpensesRes, budgetsRes, anyExpenseRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, color, icon')
      .eq('user_id', userId)
      .returns<Array<{ id: string; name: string; color: string; icon: string }>>(),
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .gte('expense_date', prevMonthStart)
      .lt('expense_date', nextMonthStart)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .returns<ExpenseRow[]>(),
    supabase
      .from('budgets')
      .select('category_id, monthly_limit_cents')
      .eq('user_id', userId)
      .order('monthly_limit_cents', { ascending: false })
      .returns<Array<{ category_id: string; monthly_limit_cents: number }>>(),
    supabase
      .from('expenses')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .returns<Array<{ id: string }>>(),
  ]);

  if (
    categoriesRes.error ||
    periodExpensesRes.error ||
    budgetsRes.error ||
    anyExpenseRes.error
  ) {
    console.error(
      '[Dashboard Fetch Error]',
      categoriesRes.error?.code ||
        periodExpensesRes.error?.code ||
        budgetsRes.error?.code ||
        anyExpenseRes.error?.code
    );
    return c.json({ error: 'Não foi possível carregar os dados do dashboard.' }, 500);
  }

  const categoryMap = new Map(
    (categoriesRes.data ?? []).map((cat) => [cat.id, cat])
  );

  let totalCents = 0;
  let previousTotalCents = 0;
  let expenseCount = 0;
  const activeDaySet = new Set<string>();

  const categoryAgg = new Map<
    string,
    {
      categoryId: string;
      categoryName: string;
      categoryColor: string;
      categoryIcon: string;
      totalCents: number;
      expenseCount: number;
    }
  >();

  const dayAgg = new Map<
    string,
    { expenseDate: string; totalCents: number; expenseCount: number }
  >();

  const recentRows: ExpenseRow[] = [];

  for (const row of periodExpensesRes.data ?? []) {
    if (row.expense_date < monthStart) {
      previousTotalCents += row.amount_cents;
      continue;
    }

    totalCents += row.amount_cents;
    expenseCount += 1;
    activeDaySet.add(row.expense_date);

    const cat = categoryMap.get(row.category_id);
    if (cat) {
      const existingCat = categoryAgg.get(cat.id);
      if (existingCat) {
        existingCat.totalCents += row.amount_cents;
        existingCat.expenseCount += 1;
      } else {
        categoryAgg.set(cat.id, {
          categoryId: cat.id,
          categoryName: cat.name,
          categoryColor: cat.color,
          categoryIcon: cat.icon,
          totalCents: row.amount_cents,
          expenseCount: 1,
        });
      }
    }

    const existingDay = dayAgg.get(row.expense_date);
    if (existingDay) {
      existingDay.totalCents += row.amount_cents;
      existingDay.expenseCount += 1;
    } else {
      dayAgg.set(row.expense_date, {
        expenseDate: row.expense_date,
        totalCents: row.amount_cents,
        expenseCount: 1,
      });
    }

    if (recentRows.length < 5) {
      recentRows.push({
        ...row,
        category_name: cat?.name ?? null,
        category_color: cat?.color ?? null,
        category_icon: cat?.icon ?? null,
      });
    }
  }

  const variationPct =
    previousTotalCents > 0
      ? Number((((totalCents - previousTotalCents) / previousTotalCents) * 100).toFixed(1))
      : null;

  const byCategory = Array.from(categoryAgg.values()).sort(
    (a, b) => b.totalCents - a.totalCents
  );

  const byDay = Array.from(dayAgg.values()).sort((a, b) =>
    a.expenseDate.localeCompare(b.expenseDate)
  );

  const budgets = (budgetsRes.data ?? [])
    .map((b) => {
      const cat = categoryMap.get(b.category_id);
      if (!cat) return null;
      return {
        categoryId: b.category_id,
        categoryName: cat.name,
        categoryColor: cat.color,
        categoryIcon: cat.icon,
        monthlyLimitCents: b.monthly_limit_cents,
        spentCents: categoryAgg.get(b.category_id)?.totalCents ?? 0,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return c.json({
    month,
    previousMonth,
    totalCents,
    previousTotalCents,
    variationPct,
    expenseCount,
    activeDays: activeDaySet.size,
    hasAnyExpense: (anyExpenseRes.data ?? []).length > 0,
    byCategory,
    byDay,
    recentExpenses: recentRows.map(mapExpenseRow),
    budgets,
  });
});
