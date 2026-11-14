import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase';
import type { AppContextEnv } from '../types';
import { getTodaySaoPauloISO } from './expenses';

const monthSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, 'Formato de mês inválido. Use AAAA-MM.');

function shiftMonthISO(monthIso: string, deltaMonths: number): string {
  const [y, m] = monthIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

const putBudgetSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== 'object') return raw;
    const obj = raw as Record<string, unknown>;
    return {
      monthly_limit_cents: obj.monthly_limit_cents ?? obj.monthlyLimitCents,
    };
  },
  z.object({
    monthly_limit_cents: z
      .number({ message: 'Informe um limite numérico em centavos.' })
      .int('O limite deve ser um número inteiro em centavos.')
      .gt(0, 'O limite mensal deve ser maior que zero.')
      .lte(100_000_000, 'O limite máximo permitido é R$ 1.000.000,00.'),
  })
);

export const budgetsRoutes = new Hono<AppContextEnv>();

budgetsRoutes.get('/budgets', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseClient(c);

  const rawMonth = c.req.query('month');
  const targetMonth = rawMonth ? rawMonth : getTodaySaoPauloISO().slice(0, 7);
  const parsedMonth = monthSchema.safeParse(targetMonth);

  if (!parsedMonth.success) {
    return c.json({ error: parsedMonth.error.issues[0]?.message || 'Mês inválido.' }, 400);
  }

  const month = parsedMonth.data;
  const monthStart = `${month}-01`;
  const nextMonthStart = `${shiftMonthISO(month, 1)}-01`;

  const [budgetsRes, categoriesRes, expensesRes] = await Promise.all([
    supabase
      .from('budgets')
      .select('category_id, monthly_limit_cents')
      .eq('user_id', userId)
      .order('monthly_limit_cents', { ascending: false })
      .returns<Array<{ category_id: string; monthly_limit_cents: number }>>(),
    supabase
      .from('categories')
      .select('id, name, color, icon')
      .eq('user_id', userId)
      .returns<Array<{ id: string; name: string; color: string; icon: string }>>(),
    supabase
      .from('expenses')
      .select('category_id, amount_cents')
      .eq('user_id', userId)
      .gte('expense_date', monthStart)
      .lt('expense_date', nextMonthStart)
      .returns<Array<{ category_id: string; amount_cents: number }>>(),
  ]);

  if (budgetsRes.error || categoriesRes.error || expensesRes.error) {
    console.error(
      '[Budgets Fetch Error]',
      budgetsRes.error?.code || categoriesRes.error?.code || expensesRes.error?.code
    );
    return c.json({ error: 'Não foi possível carregar os orçamentos.' }, 500);
  }

  const categoryMap = new Map(
    (categoriesRes.data ?? []).map((cat) => [cat.id, cat])
  );
  const spentMap = new Map<string, number>();
  for (const exp of expensesRes.data ?? []) {
    spentMap.set(exp.category_id, (spentMap.get(exp.category_id) ?? 0) + exp.amount_cents);
  }

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
        spentCents: spentMap.get(b.category_id) ?? 0,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  return c.json({ month, budgets });
});

budgetsRoutes.put('/budgets/:category_id', async (c) => {
  const userId = c.get('userId');
  const categoryId = c.req.param('category_id');
  const supabase = getSupabaseClient(c);

  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json({ error: 'Corpo da requisição inválido.' }, 400);
  }

  const parsed = putBudgetSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Dados inválidos.' }, 400);
  }

  const { data: category, error: catErr } = await supabase
    .from('categories')
    .select('id, name, color, icon')
    .eq('id', categoryId)
    .eq('user_id', userId)
    .maybeSingle<{ id: string; name: string; color: string; icon: string }>();

  if (catErr) {
    console.error('[Budget Category Lookup Error]', catErr.code);
    return c.json({ error: 'Não foi possível salvar o orçamento.' }, 500);
  }

  if (!category) {
    return c.json({ error: 'Categoria não encontrada.' }, 404);
  }

  const now = new Date().toISOString();
  const limitCents = parsed.data.monthly_limit_cents;

  const { error: upsertErr } = await supabase.from('budgets').upsert(
    {
      user_id: userId,
      category_id: categoryId,
      monthly_limit_cents: limitCents,
      updated_at: now,
    },
    { onConflict: 'user_id,category_id' }
  );

  if (upsertErr) {
    console.error('[Budget Upsert Error]', upsertErr.code);
    return c.json({ error: 'Não foi possível salvar o orçamento.' }, 500);
  }

  const currentMonth = getTodaySaoPauloISO().slice(0, 7);
  const monthStart = `${currentMonth}-01`;
  const nextMonthStart = `${shiftMonthISO(currentMonth, 1)}-01`;

  const { data: spentRows } = await supabase
    .from('expenses')
    .select('amount_cents')
    .eq('user_id', userId)
    .eq('category_id', categoryId)
    .gte('expense_date', monthStart)
    .lt('expense_date', nextMonthStart)
    .returns<Array<{ amount_cents: number }>>();

  const spentCents = (spentRows ?? []).reduce((sum, row) => sum + row.amount_cents, 0);

  return c.json({
    budget: {
      categoryId: category.id,
      categoryName: category.name,
      categoryColor: category.color,
      categoryIcon: category.icon,
      monthlyLimitCents: limitCents,
      spentCents,
    },
  });
});

budgetsRoutes.delete('/budgets/:category_id', async (c) => {
  const userId = c.get('userId');
  const categoryId = c.req.param('category_id');
  const supabase = getSupabaseClient(c);

  const { error } = await supabase
    .from('budgets')
    .delete()
    .eq('user_id', userId)
    .eq('category_id', categoryId);

  if (error) {
    console.error('[Budget Delete Error]', error.code);
    return c.json({ error: 'Não foi possível remover o orçamento.' }, 500);
  }

  return c.json({ ok: true, categoryId });
});
