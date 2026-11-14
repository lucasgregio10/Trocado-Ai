import { Hono } from 'hono';
import { getSupabaseClient } from '../lib/supabase';
import type { AppContextEnv } from '../types';
import { getTodaySaoPauloISO, isValidISODate } from './expenses';

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  pix: 'PIX',
  credito: 'Cartão de Crédito',
  debito: 'Cartão de Débito',
  dinheiro: 'Dinheiro',
  outro: 'Outro',
};

const SOURCE_LABELS: Record<string, string> = {
  foto: 'Foto (IA)',
  texto: 'Texto (IA)',
  voz: 'Voz (IA)',
  manual: 'Manual',
};

function shiftMonthISO(monthIso: string, deltaMonths: number): string {
  const [y, m] = monthIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatDateBR(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function escapeCsvCell(value: string): string {
  const cleaned = value.replace(/\r?\n/g, ' ');
  return `"${cleaned.replace(/"/g, '""')}"`;
}

interface RawExpenseForRecurring {
  merchant: string;
  amount_cents: number;
  expense_date: string;
  ym: string;
  category_name: string | null;
}

function detectRecurringExpenses(rows: RawExpenseForRecurring[]) {
  const groups = new Map<string, RawExpenseForRecurring[]>();

  for (const row of rows) {
    const key = row.merchant.trim().toLowerCase();
    if (!key) continue;
    const list = groups.get(key);
    if (list) {
      list.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const recurring: Array<{
    merchant: string;
    categoryName: string;
    avgCents: number;
    monthsCount: number;
    occurrences: number;
    lastDate: string;
  }> = [];

  for (const entries of groups.values()) {
    const distinctTotalMonths = new Set(entries.map((e) => e.ym));
    if (distinctTotalMonths.size < 3) continue;

    const sortedByAmount = [...entries].sort((a, b) => a.amount_cents - b.amount_cents);
    let bestCluster: RawExpenseForRecurring[] = [];
    let bestMonthsCount = 0;

    for (let i = 0; i < sortedByAmount.length; i++) {
      const anchor = sortedByAmount[i].amount_cents;
      const minBound = anchor * 0.9;
      const maxBound = anchor * 1.1;
      const cluster = sortedByAmount.filter(
        (item) => item.amount_cents >= minBound && item.amount_cents <= maxBound
      );
      const clusterMonths = new Set(cluster.map((c) => c.ym)).size;
      if (
        clusterMonths >= 3 &&
        (clusterMonths > bestMonthsCount ||
          (clusterMonths === bestMonthsCount && cluster.length > bestCluster.length))
      ) {
        bestCluster = cluster;
        bestMonthsCount = clusterMonths;
      }
    }

    if (bestMonthsCount >= 3 && bestCluster.length >= 3) {
      const avgCents = Math.round(
        bestCluster.reduce((sum, item) => sum + item.amount_cents, 0) / bestCluster.length
      );
      const latest = [...bestCluster].sort((a, b) =>
        b.expense_date.localeCompare(a.expense_date)
      )[0];

      recurring.push({
        merchant: latest.merchant,
        categoryName: latest.category_name || 'Outros',
        avgCents,
        monthsCount: bestMonthsCount,
        occurrences: bestCluster.length,
        lastDate: latest.expense_date,
      });
    }
  }

  return recurring.sort(
    (a, b) => b.monthsCount - a.monthsCount || b.avgCents - a.avgCents
  );
}

export const reportsRoutes = new Hono<AppContextEnv>();

reportsRoutes.get('/reports', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseClient(c);

  const todayISO = getTodaySaoPauloISO();
  const defaultFrom = `${shiftMonthISO(todayISO.slice(0, 7), -5)}-01`;
  const rawFrom = c.req.query('from')?.trim();
  const rawTo = c.req.query('to')?.trim();

  const from = rawFrom || defaultFrom;
  const to = rawTo || todayISO;

  if (!isValidISODate(from) || !isValidISODate(to)) {
    return c.json({ error: 'Datas inválidas. Use o formato AAAA-MM-DD.' }, 400);
  }

  if (from > to) {
    return c.json({ error: 'A data inicial não pode ser maior que a data final.' }, 400);
  }

  const [catRes, expRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name, color')
      .eq('user_id', userId)
      .returns<Array<{ id: string; name: string; color: string }>>(),
    supabase
      .from('expenses')
      .select('merchant, amount_cents, expense_date, category_id')
      .eq('user_id', userId)
      .gte('expense_date', from)
      .lte('expense_date', to)
      .order('expense_date', { ascending: false })
      .returns<
        Array<{
          merchant: string;
          amount_cents: number;
          expense_date: string;
          category_id: string;
        }>
      >(),
  ]);

  if (catRes.error || expRes.error) {
    console.error('[Reports Fetch Error]', catRes.error?.code || expRes.error?.code);
    return c.json({ error: 'Não foi possível gerar os relatórios.' }, 500);
  }

  const categoryMap = new Map((catRes.data ?? []).map((cat) => [cat.id, cat]));
  const expenses = expRes.data ?? [];

  let totalCents = 0;
  const expenseCount = expenses.length;

  const monthBuckets = new Map<
    string,
    {
      month: string;
      totalCents: number;
      categoriesMap: Map<
        string,
        {
          categoryId: string;
          categoryName: string;
          categoryColor: string;
          totalCents: number;
        }
      >;
    }
  >();

  const merchantAgg = new Map<
    string,
    { merchant: string; totalCents: number; expenseCount: number; categoryName: string }
  >();

  const recurringInput: RawExpenseForRecurring[] = [];

  for (const row of expenses) {
    totalCents += row.amount_cents;
    const ym = row.expense_date.slice(0, 7);
    const cat = categoryMap.get(row.category_id);
    const categoryName = cat?.name || 'Outros';

    if (cat) {
      let bucket = monthBuckets.get(ym);
      if (!bucket) {
        bucket = {
          month: ym,
          totalCents: 0,
          categoriesMap: new Map(),
        };
        monthBuckets.set(ym, bucket);
      }
      bucket.totalCents += row.amount_cents;
      const catEntry = bucket.categoriesMap.get(cat.id);
      if (catEntry) {
        catEntry.totalCents += row.amount_cents;
      } else {
        bucket.categoriesMap.set(cat.id, {
          categoryId: cat.id,
          categoryName: cat.name,
          categoryColor: cat.color,
          totalCents: row.amount_cents,
        });
      }
    }

    const mKey = row.merchant.trim().toLowerCase();
    if (mKey) {
      const mEntry = merchantAgg.get(mKey);
      if (mEntry) {
        mEntry.totalCents += row.amount_cents;
        mEntry.expenseCount += 1;
      } else {
        merchantAgg.set(mKey, {
          merchant: row.merchant,
          totalCents: row.amount_cents,
          expenseCount: 1,
          categoryName,
        });
      }
    }

    recurringInput.push({
      merchant: row.merchant,
      amount_cents: row.amount_cents,
      expense_date: row.expense_date,
      ym,
      category_name: categoryName,
    });
  }

  const monthlyByCategory = Array.from(monthBuckets.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((bucket) => ({
      month: bucket.month,
      totalCents: bucket.totalCents,
      categories: Array.from(bucket.categoriesMap.values()).sort(
        (a, b) => b.totalCents - a.totalCents
      ),
    }));

  const topMerchants = Array.from(merchantAgg.values())
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 10);

  const recurring = detectRecurringExpenses(recurringInput);

  return c.json({
    from,
    to,
    totalCents,
    expenseCount,
    monthlyByCategory,
    topMerchants,
    recurring,
  });
});

reportsRoutes.get('/export.csv', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseClient(c);

  const rawFrom = c.req.query('from')?.trim();
  const rawTo = c.req.query('to')?.trim();

  if (rawFrom && !isValidISODate(rawFrom)) {
    return c.json({ error: 'Data inicial inválida. Use AAAA-MM-DD.' }, 400);
  }
  if (rawTo && !isValidISODate(rawTo)) {
    return c.json({ error: 'Data final inválida. Use AAAA-MM-DD.' }, 400);
  }
  if (rawFrom && rawTo && rawFrom > rawTo) {
    return c.json({ error: 'A data inicial não pode ser maior que a data final.' }, 400);
  }

  let expQuery = supabase
    .from('expenses')
    .select(
      'expense_date, merchant, category_id, subcategory, payment_method, amount_cents, source, description'
    )
    .eq('user_id', userId);

  if (rawFrom) expQuery = expQuery.gte('expense_date', rawFrom);
  if (rawTo) expQuery = expQuery.lte('expense_date', rawTo);

  const [catRes, expRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', userId)
      .returns<Array<{ id: string; name: string }>>(),
    expQuery
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .returns<
        Array<{
          expense_date: string;
          merchant: string;
          category_id: string;
          subcategory: string | null;
          payment_method: string;
          amount_cents: number;
          source: string;
          description: string | null;
        }>
      >(),
  ]);

  if (catRes.error || expRes.error) {
    console.error('[Export CSV Error]', catRes.error?.code || expRes.error?.code);
    return c.json({ error: 'Não foi possível exportar as despesas.' }, 500);
  }

  const categoryMap = new Map((catRes.data ?? []).map((cat) => [cat.id, cat.name]));

  const headers = [
    'Data',
    'Estabelecimento',
    'Categoria',
    'Subcategoria',
    'Forma de pagamento',
    'Valor (R$)',
    'Origem',
    'Observação',
  ];

  const lines = [headers.join(';')];

  for (const row of expRes.data ?? []) {
    const line = [
      formatDateBR(row.expense_date),
      escapeCsvCell(row.merchant),
      escapeCsvCell(categoryMap.get(row.category_id) || 'Outros'),
      escapeCsvCell(row.subcategory || ''),
      escapeCsvCell(PAYMENT_METHOD_LABELS[row.payment_method] || row.payment_method),
      (row.amount_cents / 100).toFixed(2).replace('.', ','),
      escapeCsvCell(SOURCE_LABELS[row.source] || row.source),
      escapeCsvCell(row.description || ''),
    ].join(';');

    lines.push(line);
  }

  const csvBody = '\uFEFF' + lines.join('\r\n');
  const todayISO = getTodaySaoPauloISO();
  const filename = `trocado-despesas-${todayISO}.csv`;

  return new Response(csvBody, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
});
