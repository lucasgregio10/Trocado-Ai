import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase';
import type { AppContextEnv } from '../types';

const SAO_PAULO_TZ = 'America/Sao_Paulo';

export interface ExpenseRow {
  id: string;
  user_id: string;
  amount_cents: number;
  merchant: string;
  description: string | null;
  category_id: string;
  subcategory: string | null;
  payment_method: 'pix' | 'credito' | 'debito' | 'dinheiro' | 'outro';
  expense_date: string;
  source: 'foto' | 'texto' | 'voz' | 'manual';
  ai_confidence: number | null;
  receipt_key: string | null;
  created_at: string;
  updated_at: string;
  category_name?: string | null;
  category_color?: string | null;
  category_icon?: string | null;
}

interface CategoryMeta {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export function mapExpenseRow(row: ExpenseRow) {
  return {
    id: row.id,
    amountCents: row.amount_cents,
    merchant: row.merchant,
    description: row.description,
    categoryId: row.category_id,
    categoryName: row.category_name ?? undefined,
    categoryColor: row.category_color ?? undefined,
    categoryIcon: row.category_icon ?? undefined,
    subcategory: row.subcategory,
    paymentMethod: row.payment_method,
    expenseDate: row.expense_date,
    source: row.source,
    aiConfidence: row.ai_confidence,
    receiptKey: row.receipt_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function enrichExpenses(
  rows: ExpenseRow[],
  categoryMap: Map<string, CategoryMeta>
): ExpenseRow[] {
  return rows.map((row) => {
    const cat = categoryMap.get(row.category_id);
    return {
      ...row,
      category_name: cat?.name ?? row.category_name ?? null,
      category_color: cat?.color ?? row.category_color ?? null,
      category_icon: cat?.icon ?? row.category_icon ?? null,
    };
  });
}

export function getTodaySaoPauloISO(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: SAO_PAULO_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function addDaysISO(isoDate: string, deltaDays: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

export function isValidISODate(isoDate: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return false;
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

const paymentMethodEnum = z.enum(['pix', 'credito', 'debito', 'dinheiro', 'outro'], {
  message: 'Forma de pagamento inválida.',
});

const sourceEnum = z.enum(['foto', 'texto', 'voz', 'manual'], {
  message: 'Origem da despesa inválida.',
});

const expenseDateSchema = z
  .string({ message: 'Informe a data da despesa.' })
  .trim()
  .refine(isValidISODate, { message: 'Data inválida. Use o formato AAAA-MM-DD.' })
  .refine(
    (date) => {
      const maxAllowed = addDaysISO(getTodaySaoPauloISO(), 1);
      return date <= maxAllowed;
    },
    { message: 'A data da despesa não pode ser superior a 1 dia no futuro.' }
  );

function normalizeExpenseBody(raw: unknown) {
  if (!raw || typeof raw !== 'object') return raw;
  const r = raw as Record<string, unknown>;
  return {
    amount_cents: r.amount_cents ?? r.amountCents,
    merchant: r.merchant,
    description: r.description,
    category_id: r.category_id ?? r.categoryId,
    subcategory: r.subcategory,
    payment_method: r.payment_method ?? r.paymentMethod,
    expense_date: r.expense_date ?? r.expenseDate,
    source: r.source,
    ai_confidence: r.ai_confidence ?? r.aiConfidence,
    receipt_key: r.receipt_key ?? r.receiptKey,
  };
}

const createExpenseSchema = z.preprocess(
  normalizeExpenseBody,
  z.object({
    amount_cents: z
      .number({ message: 'Informe um valor numérico em centavos.' })
      .int('O valor em centavos deve ser inteiro.')
      .gt(0, 'O valor deve ser maior que zero.')
      .lte(100_000_000, 'O valor máximo permitido é R$ 1.000.000,00.'),
    merchant: z
      .string({ message: 'Informe o estabelecimento.' })
      .trim()
      .min(1, 'Informe o estabelecimento.')
      .max(120, 'O estabelecimento deve ter no máximo 120 caracteres.'),
    description: z
      .string()
      .trim()
      .max(500, 'A observação deve ter no máximo 500 caracteres.')
      .nullable()
      .optional(),
    category_id: z
      .string({ message: 'Selecione uma categoria.' })
      .trim()
      .min(1, 'Selecione uma categoria.'),
    subcategory: z
      .string()
      .trim()
      .max(80, 'A subcategoria deve ter no máximo 80 caracteres.')
      .nullable()
      .optional(),
    payment_method: paymentMethodEnum,
    expense_date: expenseDateSchema,
    source: sourceEnum.default('manual'),
    ai_confidence: z.number().min(0).max(100).nullable().optional(),
    receipt_key: z.string().trim().max(255).nullable().optional(),
  })
);

const updateExpenseSchema = z.preprocess(
  normalizeExpenseBody,
  z
    .object({
      amount_cents: z
        .number({ message: 'Informe um valor numérico em centavos.' })
        .int('O valor em centavos deve ser inteiro.')
        .gt(0, 'O valor deve ser maior que zero.')
        .lte(100_000_000, 'O valor máximo permitido é R$ 1.000.000,00.')
        .optional(),
      merchant: z
        .string()
        .trim()
        .min(1, 'Informe o estabelecimento.')
        .max(120, 'O estabelecimento deve ter no máximo 120 caracteres.')
        .optional(),
      description: z
        .string()
        .trim()
        .max(500, 'A observação deve ter no máximo 500 caracteres.')
        .nullable()
        .optional(),
      category_id: z.string().trim().min(1, 'Selecione uma categoria.').optional(),
      subcategory: z
        .string()
        .trim()
        .max(80, 'A subcategoria deve ter no máximo 80 caracteres.')
        .nullable()
        .optional(),
      payment_method: paymentMethodEnum.optional(),
      expense_date: expenseDateSchema.optional(),
      source: sourceEnum.optional(),
      ai_confidence: z.number().min(0).max(100).nullable().optional(),
      receipt_key: z.string().trim().max(255).nullable().optional(),
    })
    .refine((obj) => Object.values(obj).some((v) => v !== undefined), {
      message: 'Informe ao menos um campo para atualizar.',
    })
);

interface CursorPayload {
  expenseDate: string;
  createdAt: string;
  id: string;
}

function encodeCursor(cursor: CursorPayload): string {
  const json = JSON.stringify(cursor);
  return btoa(unescape(encodeURIComponent(json)));
}

function decodeCursor(raw: string): CursorPayload | null {
  try {
    const json = decodeURIComponent(escape(atob(raw)));
    const parsed = JSON.parse(json) as Partial<CursorPayload>;
    if (
      typeof parsed.expenseDate === 'string' &&
      isValidISODate(parsed.expenseDate) &&
      typeof parsed.createdAt === 'string' &&
      typeof parsed.id === 'string' &&
      parsed.id.length > 0
    ) {
      return {
        expenseDate: parsed.expenseDate,
        createdAt: parsed.createdAt,
        id: parsed.id,
      };
    }
    return null;
  } catch {
    return null;
  }
}

const listQuerySchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional(),
  category_id: z.string().trim().optional(),
  payment_method: z.string().trim().optional(),
  source: z.string().trim().optional(),
  q: z.string().trim().max(120).optional(),
  min: z.string().trim().optional(),
  max: z.string().trim().optional(),
  cursor: z.string().trim().optional(),
  limit: z.string().trim().optional(),
});

const duplicatesQuerySchema = z.object({
  amount_cents: z.coerce
    .number({ message: 'Informe amount_cents válido.' })
    .int('amount_cents deve ser inteiro.')
    .gt(0, 'amount_cents deve ser maior que zero.'),
  expense_date: z
    .string({ message: 'Informe expense_date.' })
    .trim()
    .refine(isValidISODate, { message: 'expense_date inválido. Use AAAA-MM-DD.' }),
  merchant: z.string().trim().max(120).optional(),
});

function quoteFilterVal(val: string): string {
  return `"${val.replace(/"/g, '')}"`;
}

export const expensesRoutes = new Hono<AppContextEnv>();

expensesRoutes.get('/expenses/duplicates', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseClient(c);

  const parsed = duplicatesQuerySchema.safeParse({
    amount_cents: c.req.query('amount_cents'),
    expense_date: c.req.query('expense_date'),
    merchant: c.req.query('merchant'),
  });

  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message || 'Parâmetros inválidos.';
    return c.json({ error: msg }, 400);
  }

  const { amount_cents, expense_date, merchant } = parsed.data;
  const fromDate = addDaysISO(expense_date, -1);
  const toDate = addDaysISO(expense_date, 1);

  const [expRes, catRes] = await Promise.all([
    supabase
      .from('expenses')
      .select('*')
      .eq('user_id', userId)
      .eq('amount_cents', amount_cents)
      .gte('expense_date', fromDate)
      .lte('expense_date', toDate)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(20)
      .returns<ExpenseRow[]>(),
    supabase
      .from('categories')
      .select('id, name, color, icon')
      .eq('user_id', userId)
      .returns<CategoryMeta[]>(),
  ]);

  if (expRes.error) {
    console.error('[Duplicates Fetch Error]', expRes.error.code);
    return c.json({ error: 'Não foi possível verificar duplicatas.' }, 500);
  }

  const categoryMap = new Map((catRes.data ?? []).map((cat) => [cat.id, cat]));
  let rows = enrichExpenses(expRes.data ?? [], categoryMap);

  if (merchant && merchant.length > 0) {
    const normalizedMerchant = merchant.toLowerCase();
    rows = [...rows].sort((a, b) => {
      const aMatch = a.merchant.toLowerCase().includes(normalizedMerchant) ? 1 : 0;
      const bMatch = b.merchant.toLowerCase().includes(normalizedMerchant) ? 1 : 0;
      return bMatch - aMatch;
    });
  }

  return c.json({ items: rows.map(mapExpenseRow) });
});

expensesRoutes.get('/expenses', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseClient(c);

  const parsed = listQuerySchema.safeParse({
    from: c.req.query('from'),
    to: c.req.query('to'),
    category_id: c.req.query('category_id'),
    payment_method: c.req.query('payment_method'),
    source: c.req.query('source'),
    q: c.req.query('q'),
    min: c.req.query('min'),
    max: c.req.query('max'),
    cursor: c.req.query('cursor'),
    limit: c.req.query('limit'),
  });

  if (!parsed.success) {
    return c.json({ error: 'Parâmetros de filtro inválidos.' }, 400);
  }

  const query = parsed.data;
  let limit = 30;
  if (query.limit) {
    const num = Number.parseInt(query.limit, 10);
    if (!Number.isFinite(num) || num < 1 || num > 100) {
      return c.json({ error: 'O parâmetro limit deve ser entre 1 e 100.' }, 400);
    }
    limit = num;
  }

  if (query.from && !isValidISODate(query.from)) {
    return c.json({ error: 'Data inicial (from) inválida.' }, 400);
  }
  if (query.to && !isValidISODate(query.to)) {
    return c.json({ error: 'Data final (to) inválida.' }, 400);
  }

  let minCents: number | null = null;
  if (query.min) {
    const n = Number.parseInt(query.min, 10);
    if (!Number.isFinite(n) || n < 0) {
      return c.json({ error: 'Valor mínimo inválido.' }, 400);
    }
    minCents = n;
  }

  let maxCents: number | null = null;
  if (query.max) {
    const n = Number.parseInt(query.max, 10);
    if (!Number.isFinite(n) || n < 0) {
      return c.json({ error: 'Valor máximo inválido.' }, 400);
    }
    maxCents = n;
  }

  if (query.payment_method) {
    const pm = paymentMethodEnum.safeParse(query.payment_method);
    if (!pm.success) {
      return c.json({ error: 'Forma de pagamento inválida.' }, 400);
    }
  }

  let validSourceFilter: z.infer<typeof sourceEnum> | 'ai' | null = null;
  if (query.source) {
    if (query.source === 'ai') {
      validSourceFilter = 'ai';
    } else {
      const srcCheck = sourceEnum.safeParse(query.source);
      if (!srcCheck.success) {
        return c.json({ error: 'Origem de filtro inválida.' }, 400);
      }
      validSourceFilter = srcCheck.data;
    }
  }

  let decodedCursor: CursorPayload | null = null;
  if (query.cursor) {
    decodedCursor = decodeCursor(query.cursor);
    if (!decodedCursor) {
      return c.json({ error: 'Cursor de paginação inválido.' }, 400);
    }
  }

  const { data: userCategories, error: catErr } = await supabase
    .from('categories')
    .select('id, name, color, icon')
    .eq('user_id', userId)
    .returns<CategoryMeta[]>();

  if (catErr) {
    console.error('[Expenses Categories Fetch Error]', catErr.code);
    return c.json({ error: 'Não foi possível carregar as despesas.' }, 500);
  }

  const categoryMap = new Map((userCategories ?? []).map((cat) => [cat.id, cat]));

  const cleanSearch = query.q ? query.q.replace(/[,()\\"]/g, ' ').trim() : '';
  const searchLower = cleanSearch.toLowerCase();
  const matchingCategoryIds =
    cleanSearch.length > 0
      ? (userCategories ?? [])
          .filter((cat) => cat.name.toLowerCase().includes(searchLower))
          .map((cat) => cat.id)
      : [];

  function applyCommonFilters<T>(builder: T): T {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let b: any = builder;
    b = b.eq('user_id', userId);
    if (query.from) b = b.gte('expense_date', query.from);
    if (query.to) b = b.lte('expense_date', query.to);
    if (query.category_id) b = b.eq('category_id', query.category_id);
    if (query.payment_method) b = b.eq('payment_method', query.payment_method);
    if (validSourceFilter === 'ai') {
      b = b.neq('source', 'manual');
    } else if (validSourceFilter) {
      b = b.eq('source', validSourceFilter);
    }
    if (minCents !== null) b = b.gte('amount_cents', minCents);
    if (maxCents !== null) b = b.lte('amount_cents', maxCents);
    if (cleanSearch.length > 0) {
      const pattern = quoteFilterVal(`%${cleanSearch}%`);
      const orParts = [
        `merchant.ilike.${pattern}`,
        `description.ilike.${pattern}`,
        `subcategory.ilike.${pattern}`,
      ];
      if (matchingCategoryIds.length > 0) {
        orParts.push(`category_id.in.(${matchingCategoryIds.join(',')})`);
      }
      b = b.or(orParts.join(','));
    }
    return b as T;
  }

  const summaryQuery = applyCommonFilters(
    supabase.from('expenses').select('amount_cents, source')
  );

  let itemsQuery = applyCommonFilters(supabase.from('expenses').select('*'));

  if (decodedCursor) {
    const d = quoteFilterVal(decodedCursor.expenseDate);
    const cr = quoteFilterVal(decodedCursor.createdAt);
    const cid = quoteFilterVal(decodedCursor.id);
    itemsQuery = itemsQuery.or(
      `expense_date.lt.${d},and(expense_date.eq.${d},created_at.lt.${cr}),and(expense_date.eq.${d},created_at.eq.${cr},id.lt.${cid})`
    );
  }

  itemsQuery = itemsQuery
    .order('expense_date', { ascending: false })
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(limit + 1);

  const [summaryRes, itemsRes] = await Promise.all([
    summaryQuery.returns<Array<{ amount_cents: number; source: string }>>(),
    itemsQuery.returns<ExpenseRow[]>(),
  ]);

  if (summaryRes.error || itemsRes.error) {
    console.error('[Expenses List Error]', summaryRes.error?.code || itemsRes.error?.code);
    return c.json({ error: 'Não foi possível carregar as despesas.' }, 500);
  }

  const summaryRows = summaryRes.data ?? [];
  const totalCount = summaryRows.length;
  let totalCents = 0;
  let aiCount = 0;
  for (const row of summaryRows) {
    totalCents += row.amount_cents;
    if (row.source !== 'manual') aiCount += 1;
  }

  const allRows = itemsRes.data ?? [];
  const hasMore = allRows.length > limit;
  const pageRows = enrichExpenses(hasMore ? allRows.slice(0, limit) : allRows, categoryMap);

  const last = pageRows[pageRows.length - 1];
  const nextCursor =
    hasMore && last
      ? encodeCursor({
          expenseDate: last.expense_date,
          createdAt: last.created_at,
          id: last.id,
        })
      : null;

  return c.json({
    items: pageRows.map(mapExpenseRow),
    nextCursor,
    summary: {
      totalCount,
      totalCents,
      aiCount,
    },
  });
});

expensesRoutes.get('/expenses/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c);

  const { data: row, error } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle<ExpenseRow>();

  if (error) {
    console.error('[Expense Get Error]', error.code);
    return c.json({ error: 'Não foi possível carregar a despesa.' }, 500);
  }

  if (!row) {
    return c.json({ error: 'Despesa não encontrada.' }, 404);
  }

  const { data: cat } = await supabase
    .from('categories')
    .select('id, name, color, icon')
    .eq('id', row.category_id)
    .eq('user_id', userId)
    .maybeSingle<CategoryMeta>();

  const enriched: ExpenseRow = {
    ...row,
    category_name: cat?.name ?? null,
    category_color: cat?.color ?? null,
    category_icon: cat?.icon ?? null,
  };

  return c.json({ expense: mapExpenseRow(enriched) });
});

expensesRoutes.post('/expenses', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseClient(c);

  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json({ error: 'Corpo da requisição inválido.' }, 400);
  }

  const parsed = createExpenseSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstMsg = parsed.error.issues[0]?.message || 'Dados da despesa inválidos.';
    return c.json({ error: firstMsg }, 400);
  }

  const data = parsed.data;

  const { data: category, error: catErr } = await supabase
    .from('categories')
    .select('id, name, color, icon')
    .eq('id', data.category_id)
    .eq('user_id', userId)
    .maybeSingle<CategoryMeta>();

  if (catErr) {
    console.error('[Expense Create Category Lookup Error]', catErr.code);
    return c.json({ error: 'Não foi possível validar a categoria.' }, 500);
  }

  if (!category) {
    return c.json({ error: 'Categoria não encontrada para este usuário.' }, 400);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const { data: created, error: insertErr } = await supabase
    .from('expenses')
    .insert({
      id,
      user_id: userId,
      amount_cents: data.amount_cents,
      merchant: data.merchant,
      description: data.description ?? null,
      category_id: category.id,
      subcategory: data.subcategory ?? null,
      payment_method: data.payment_method,
      expense_date: data.expense_date,
      source: data.source,
      ai_confidence: data.ai_confidence ?? null,
      receipt_key: data.receipt_key ?? null,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single<ExpenseRow>();

  if (insertErr || !created) {
    console.error('[Expense Create Insert Error]', insertErr?.code);
    return c.json({ error: 'Não foi possível criar a despesa.' }, 500);
  }

  const enriched: ExpenseRow = {
    ...created,
    category_name: category.name,
    category_color: category.color,
    category_icon: category.icon,
  };

  return c.json({ expense: mapExpenseRow(enriched) }, 201);
});

expensesRoutes.put('/expenses/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c);

  const { data: existing, error: findErr } = await supabase
    .from('expenses')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle<ExpenseRow>();

  if (findErr) {
    console.error('[Expense Update Lookup Error]', findErr.code);
    return c.json({ error: 'Não foi possível atualizar a despesa.' }, 500);
  }

  if (!existing) {
    return c.json({ error: 'Despesa não encontrada.' }, 404);
  }

  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json({ error: 'Corpo da requisição inválido.' }, 400);
  }

  const parsed = updateExpenseSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstMsg = parsed.error.issues[0]?.message || 'Dados da despesa inválidos.';
    return c.json({ error: firstMsg }, 400);
  }

  const data = parsed.data;
  const nextCategoryId = data.category_id ?? existing.category_id;

  if (data.category_id !== undefined) {
    const { data: category } = await supabase
      .from('categories')
      .select('id')
      .eq('id', nextCategoryId)
      .eq('user_id', userId)
      .maybeSingle<{ id: string }>();

    if (!category) {
      return c.json({ error: 'Categoria não encontrada para este usuário.' }, 400);
    }
  }

  const now = new Date().toISOString();

  const { data: updated, error: updateErr } = await supabase
    .from('expenses')
    .update({
      amount_cents: data.amount_cents ?? existing.amount_cents,
      merchant: data.merchant ?? existing.merchant,
      description: data.description !== undefined ? data.description : existing.description,
      category_id: nextCategoryId,
      subcategory: data.subcategory !== undefined ? data.subcategory : existing.subcategory,
      payment_method: data.payment_method ?? existing.payment_method,
      expense_date: data.expense_date ?? existing.expense_date,
      source: data.source ?? existing.source,
      ai_confidence: data.ai_confidence !== undefined ? data.ai_confidence : existing.ai_confidence,
      receipt_key: data.receipt_key !== undefined ? data.receipt_key : existing.receipt_key,
      updated_at: now,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single<ExpenseRow>();

  if (updateErr || !updated) {
    console.error('[Expense Update Error]', updateErr?.code);
    return c.json({ error: 'Despesa não encontrada.' }, 404);
  }

  const { data: cat } = await supabase
    .from('categories')
    .select('id, name, color, icon')
    .eq('id', updated.category_id)
    .eq('user_id', userId)
    .maybeSingle<CategoryMeta>();

  const enriched: ExpenseRow = {
    ...updated,
    category_name: cat?.name ?? null,
    category_color: cat?.color ?? null,
    category_icon: cat?.icon ?? null,
  };

  return c.json({ expense: mapExpenseRow(enriched) });
});

expensesRoutes.delete('/expenses/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c);

  const { data: existing, error: findErr } = await supabase
    .from('expenses')
    .select('id, receipt_key')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle<{ id: string; receipt_key: string | null }>();

  if (findErr) {
    console.error('[Expense Delete Lookup Error]', findErr.code);
    return c.json({ error: 'Não foi possível excluir a despesa.' }, 500);
  }

  if (!existing) {
    return c.json({ error: 'Despesa não encontrada.' }, 404);
  }

  const { data: deletedRows, error: delErr } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id');

  if (delErr) {
    console.error('[Expense Delete Error]', delErr.code);
    return c.json({ error: 'Não foi possível excluir a despesa.' }, 500);
  }

  if (!deletedRows || deletedRows.length === 0) {
    return c.json({ error: 'Despesa não encontrada.' }, 404);
  }

  if (existing.receipt_key && c.env.RECEIPTS_ENABLED === 'true' && c.env.RECEIPTS) {
    await c.env.RECEIPTS.delete(existing.receipt_key).catch(() => {});
  }

  return c.json({ ok: true, id });
});
