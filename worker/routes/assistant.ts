import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseClient, incrementDailyAiUsage } from '../lib/supabase';
import type { AppContextEnv } from '../types';
import { getTodaySaoPauloISO } from './expenses';

const assistantMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1, 'Mensagem vazia.').max(2000, 'Mensagem muito longa.'),
});

const assistantRequestSchema = z.object({
  messages: z
    .array(assistantMessageSchema)
    .min(1, 'Envie ao menos uma mensagem.')
    .max(50, 'Histórico muito grande.'),
});

function shiftMonthISO(monthIso: string, deltaMonths: number): string {
  const [y, m] = monthIso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + deltaMonths, 1));
  const year = dt.getUTCFullYear();
  const month = String(dt.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDateBR(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function isAiQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('limit exceeded') ||
    msg.includes('429') ||
    msg.includes('daily limit') ||
    msg.includes('neurons')
  );
}

export const assistantRoutes = new Hono<AppContextEnv>();

assistantRoutes.post('/assistant', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseClient(c);

  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json({ error: 'Corpo da requisição inválido.' }, 400);
  }

  const parsed = assistantRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message || 'Mensagens inválidas.' }, 400);
  }

  const recentMessages = parsed.data.messages.slice(-10);
  const todayISO = getTodaySaoPauloISO();
  const currentMonth = todayISO.slice(0, 7);
  const sixMonthsStart = `${shiftMonthISO(currentMonth, -5)}-01`;
  const monthStart = `${currentMonth}-01`;
  const nextMonthStart = `${shiftMonthISO(currentMonth, 1)}-01`;

  const dailyLimit = Number.parseInt(c.env.AI_DAILY_LIMIT_PER_USER || '60', 10) || 60;
  try {
    const callsToday = await incrementDailyAiUsage(supabase, userId, todayISO);
    if (callsToday > dailyLimit) {
      return c.json(
        {
          error:
            'Você atingiu o limite diário de uso da IA. Tente novamente amanhã.',
        },
        429
      );
    }
  } catch (err) {
    console.error('[Assistant Quota Error]', err instanceof Error ? err.message : 'Quota check failed');
    return c.json({ error: 'Não foi possível validar o uso do assistente.' }, 500);
  }

  const [catRes, sixMonthsExpRes, recentExpRes, budgetsRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', userId)
      .returns<Array<{ id: string; name: string }>>(),
    supabase
      .from('expenses')
      .select('expense_date, merchant, category_id, amount_cents')
      .eq('user_id', userId)
      .gte('expense_date', sixMonthsStart)
      .returns<
        Array<{
          expense_date: string;
          merchant: string;
          category_id: string;
          amount_cents: number;
        }>
      >(),
    supabase
      .from('expenses')
      .select('expense_date, merchant, category_id, amount_cents, payment_method')
      .eq('user_id', userId)
      .order('expense_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(50)
      .returns<
        Array<{
          expense_date: string;
          merchant: string;
          category_id: string;
          amount_cents: number;
          payment_method: string;
        }>
      >(),
    supabase
      .from('budgets')
      .select('category_id, monthly_limit_cents')
      .eq('user_id', userId)
      .returns<Array<{ category_id: string; monthly_limit_cents: number }>>(),
  ]);

  if (catRes.error || sixMonthsExpRes.error || recentExpRes.error || budgetsRes.error) {
    console.error(
      '[Assistant Context Fetch Error]',
      catRes.error?.code ||
        sixMonthsExpRes.error?.code ||
        recentExpRes.error?.code ||
        budgetsRes.error?.code
    );
    return c.json({ error: 'Não foi possível consultar seus registros no momento.' }, 500);
  }

  const categoryMap = new Map((catRes.data ?? []).map((cat) => [cat.id, cat.name]));

  const monthlyTotalsAgg = new Map<
    string,
    { month: string; categoryName: string; totalCents: number; count: number }
  >();
  const merchantAgg = new Map<
    string,
    { merchant: string; totalCents: number; count: number }
  >();
  const currentMonthSpentByCat = new Map<string, number>();

  for (const r of sixMonthsExpRes.data ?? []) {
    const ym = r.expense_date.slice(0, 7);
    const catName = categoryMap.get(r.category_id) || 'Outros';
    const mcKey = `${ym}::${r.category_id}`;
    const mcItem = monthlyTotalsAgg.get(mcKey);
    if (mcItem) {
      mcItem.totalCents += r.amount_cents;
      mcItem.count += 1;
    } else {
      monthlyTotalsAgg.set(mcKey, {
        month: ym,
        categoryName: catName,
        totalCents: r.amount_cents,
        count: 1,
      });
    }

    const mKey = r.merchant.trim().toLowerCase();
    if (mKey) {
      const mItem = merchantAgg.get(mKey);
      if (mItem) {
        mItem.totalCents += r.amount_cents;
        mItem.count += 1;
      } else {
        merchantAgg.set(mKey, {
          merchant: r.merchant,
          totalCents: r.amount_cents,
          count: 1,
        });
      }
    }

    if (r.expense_date >= monthStart && r.expense_date < nextMonthStart) {
      currentMonthSpentByCat.set(
        r.category_id,
        (currentMonthSpentByCat.get(r.category_id) ?? 0) + r.amount_cents
      );
    }
  }

  const monthlyLines = Array.from(monthlyTotalsAgg.values())
    .sort((a, b) => b.month.localeCompare(a.month) || b.totalCents - a.totalCents)
    .map((r) => `- ${r.month} | ${r.categoryName}: ${formatBRL(r.totalCents)} (${r.count}x)`);

  const merchantLines = Array.from(merchantAgg.values())
    .sort((a, b) => b.totalCents - a.totalCents)
    .slice(0, 15)
    .map((r) => `- ${r.merchant}: ${formatBRL(r.totalCents)} (${r.count}x)`);

  const expenseLines = (recentExpRes.data ?? []).map(
    (r) =>
      `- ${formatDateBR(r.expense_date)} | ${r.merchant} | ${categoryMap.get(r.category_id) || 'Outros'} | ${formatBRL(r.amount_cents)} | ${r.payment_method}`
  );

  const budgetLines = (budgetsRes.data ?? []).map(
    (r) =>
      `- ${categoryMap.get(r.category_id) || 'Outros'}: gasto ${formatBRL(currentMonthSpentByCat.get(r.category_id) ?? 0)} / limite ${formatBRL(r.monthly_limit_cents)}`
  );

  const contextBlock = [
    `Data atual (Brasília): ${formatDateBR(todayISO)} (${todayISO}). Mês atual: ${currentMonth}.`,
    '',
    'TOTAIS POR MÊS E CATEGORIA (ÚLTIMOS 6 MESES):',
    monthlyLines.length > 0 ? monthlyLines.join('\n') : '(Sem despesas nos últimos 6 meses)',
    '',
    'TOP ESTABELECIMENTOS (ÚLTIMOS 6 MESES):',
    merchantLines.length > 0 ? merchantLines.join('\n') : '(Nenhum estabelecimento registrado)',
    '',
    `ORÇAMENTOS DO MÊS ATUAL (${currentMonth}):`,
    budgetLines.length > 0 ? budgetLines.join('\n') : '(Nenhum orçamento definido)',
    '',
    '50 DESPESAS MAIS RECENTES (Data | Estabelecimento | Categoria | Valor | Pagamento):',
    expenseLines.length > 0 ? expenseLines.join('\n') : '(Nenhuma despesa registrada)',
  ].join('\n');

  const systemPrompt = [
    'Você é o Assistente Financeiro do app Trocado.',
    'Responda sempre em português brasileiro, de forma clara, objetiva e amigável.',
    'Sempre informe todos os valores monetários em R$ (ex.: R$ 45,90).',
    'REGRA ESTRITA: responda apenas com base nestes dados; se não souber ou os dados não mostrarem essa informação, diga claramente que não encontrou nos registros.',
    'Nunca invente valores, estabelecimentos ou datas.',
    '',
    contextBlock,
  ].join('\n');

  try {
    const gatewayConfig = c.env.AI_GATEWAY_ID?.trim()
      ? { gateway: { id: c.env.AI_GATEWAY_ID.trim() } }
      : undefined;

    const aiResponse = await c.env.AI.run(
      '@cf/meta/llama-4-scout-17b-16e-instruct',
      {
        messages: [{ role: 'system', content: systemPrompt }, ...recentMessages],
        stream: true,
        max_tokens: 700,
        temperature: 0.2,
      },
      gatewayConfig
    );

    if (aiResponse instanceof ReadableStream) {
      return new Response(aiResponse, {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
        },
      });
    }

    const fallbackText =
      typeof (aiResponse as { response?: unknown })?.response === 'string'
        ? ((aiResponse as { response: string }).response || '')
        : 'Não encontrei uma resposta para essa pergunta nos seus registros.';

    const encoder = new TextEncoder();
    const syntheticStream = new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ response: fallbackText })}\n\n`));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    return new Response(syntheticStream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
      },
    });
  } catch (err) {
    console.error(
      '[AI Assistant Error]',
      err instanceof Error ? err.message : 'Assistant call failed'
    );
    if (isAiQuotaError(err)) {
      return c.json(
        { error: 'A IA atingiu o limite gratuito de hoje. Tente novamente mais tarde.' },
        503
      );
    }
    return c.json({ error: 'Não foi possível consultar o assistente no momento.' }, 502);
  }
});
