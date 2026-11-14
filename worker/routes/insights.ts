import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase';
import type { AppContextEnv } from '../types';
import { getTodaySaoPauloISO } from './expenses';

const INSIGHT_CACHE_TTL_SECONDS = 12 * 60 * 60; // 12 hours

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

function formatBRL(cents: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function getCacheRequest(userId: string, month: string): Request {
  return new Request(
    `https://trocado.internal/cache/insights/${encodeURIComponent(userId)}/${encodeURIComponent(month)}`,
    { method: 'GET' }
  );
}

export const insightsRoutes = new Hono<AppContextEnv>();

insightsRoutes.get('/insights', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseClient(c);

  const rawMonth = c.req.query('month');
  const targetMonth = rawMonth ? rawMonth : getTodaySaoPauloISO().slice(0, 7);
  const parsedMonth = monthSchema.safeParse(targetMonth);

  if (!parsedMonth.success) {
    return c.json({ error: parsedMonth.error.issues[0]?.message || 'Mês inválido.' }, 400);
  }

  const month = parsedMonth.data;
  const prevMonth = shiftMonthISO(month, -1);
  const nextMonth = shiftMonthISO(month, 1);

  const monthStart = `${month}-01`;
  const nextMonthStart = `${nextMonth}-01`;
  const prevMonthStart = `${prevMonth}-01`;

  const [catRes, expRes] = await Promise.all([
    supabase
      .from('categories')
      .select('id, name')
      .eq('user_id', userId)
      .returns<Array<{ id: string; name: string }>>(),
    supabase
      .from('expenses')
      .select('merchant, amount_cents, expense_date, category_id')
      .eq('user_id', userId)
      .gte('expense_date', prevMonthStart)
      .lt('expense_date', nextMonthStart)
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
    console.error('[Insights Fetch Error]', catRes.error?.code || expRes.error?.code);
    return c.json({ error: 'Não foi possível gerar o resumo do mês.' }, 500);
  }

  const categoryMap = new Map((catRes.data ?? []).map((cat) => [cat.id, cat.name]));
  const allRows = expRes.data ?? [];

  const currentRows = allRows.filter((r) => r.expense_date >= monthStart);
  const prevRows = allRows.filter((r) => r.expense_date < monthStart);

  const expenseCount = currentRows.length;
  const totalCents = currentRows.reduce((sum, r) => sum + r.amount_cents, 0);

  if (expenseCount < 5) {
    return c.json({
      month,
      insight:
        'Dica: registre pelo menos 5 despesas neste mês para liberar uma análise automática personalizada dos seus gastos.',
      fromAi: false,
      cached: false,
      expenseCount,
    });
  }

  const cacheReq = getCacheRequest(userId, month);
  try {
    if (typeof caches !== 'undefined' && caches.default) {
      const cachedResp = await caches.default.match(cacheReq);
      if (cachedResp) {
        const cachedPayload = (await cachedResp.json()) as {
          month: string;
          insight: string;
          fromAi: boolean;
          expenseCount: number;
        };
        return c.json({
          ...cachedPayload,
          cached: true,
        });
      }
    }
  } catch {
    // Ignore Cache API read failure and compute fresh insight
  }

  const prevTotalCents = prevRows.reduce((sum, r) => sum + r.amount_cents, 0);

  const catCompMap = new Map<
    string,
    { categoryName: string; currentCents: number; prevCents: number }
  >();

  for (const r of currentRows) {
    const name = categoryMap.get(r.category_id) || 'Outros';
    const item = catCompMap.get(r.category_id) || {
      categoryName: name,
      currentCents: 0,
      prevCents: 0,
    };
    item.currentCents += r.amount_cents;
    catCompMap.set(r.category_id, item);
  }

  for (const r of prevRows) {
    const name = categoryMap.get(r.category_id) || 'Outros';
    const item = catCompMap.get(r.category_id) || {
      categoryName: name,
      currentCents: 0,
      prevCents: 0,
    };
    item.prevCents += r.amount_cents;
    catCompMap.set(r.category_id, item);
  }

  const categoriesSummary = Array.from(catCompMap.values())
    .sort((a, b) => b.currentCents - a.currentCents)
    .map((row) => {
      const pctChange =
        row.prevCents > 0
          ? `${(((row.currentCents - row.prevCents) / row.prevCents) * 100).toFixed(1)}%`
          : 'sem histórico no mês anterior';
      return `${row.categoryName}: atual ${formatBRL(row.currentCents)}, anterior ${formatBRL(row.prevCents)} (${pctChange})`;
    });

  const topExpense = [...currentRows].sort((a, b) => b.amount_cents - a.amount_cents)[0];

  const merchantFreq = new Map<
    string,
    { merchant: string; freq: number; totalCents: number }
  >();
  for (const r of currentRows) {
    const key = r.merchant.trim().toLowerCase();
    if (!key) continue;
    const entry = merchantFreq.get(key);
    if (entry) {
      entry.freq += 1;
      entry.totalCents += r.amount_cents;
    } else {
      merchantFreq.set(key, {
        merchant: r.merchant,
        freq: 1,
        totalCents: r.amount_cents,
      });
    }
  }
  const topMerchant = Array.from(merchantFreq.values()).sort(
    (a, b) => b.freq - a.freq || b.totalCents - a.totalCents
  )[0];

  const statsLines = [
    `Mês analisado: ${month} (${expenseCount} despesas, total ${formatBRL(totalCents)})`,
    `Total do mês anterior (${prevMonth}): ${formatBRL(prevTotalCents)}`,
    `Categorias: ${categoriesSummary.join(' | ') || 'nenhuma'}`,
    topExpense
      ? `Maior gasto individual: ${topExpense.merchant} (${formatBRL(topExpense.amount_cents)}, categoria ${categoryMap.get(topExpense.category_id) || 'Outros'})`
      : 'Maior gasto individual: nenhum',
    topMerchant
      ? `Estabelecimento mais frequente: ${topMerchant.merchant} (${topMerchant.freq} vezes, total ${formatBRL(topMerchant.totalCents)})`
      : 'Estabelecimento mais frequente: nenhum',
  ];

  const fallbackSentence = topExpense
    ? `Você acumulou ${formatBRL(totalCents)} em ${expenseCount} despesas neste mês, com destaque para ${topExpense.merchant} (${formatBRL(topExpense.amount_cents)}).`
    : `Você acumulou ${formatBRL(totalCents)} em ${expenseCount} despesas neste mês.`;

  let insightText = fallbackSentence;
  let fromAi = false;

  try {
    const gatewayConfig = c.env.AI_GATEWAY_ID?.trim()
      ? { gateway: { id: c.env.AI_GATEWAY_ID.trim() } }
      : undefined;

    const aiResult = await c.env.AI.run(
      '@cf/meta/llama-4-scout-17b-16e-instruct',
      {
        messages: [
          {
            role: 'system',
            content:
              'Você gera exatamente UMA frase curta e direta em português (máximo 180 caracteres) resumindo o principal destaque ou variação dos gastos do usuário. Baseie-se SOMENTE nos números fornecidos, sempre usando R$. Não use markdown, aspas nem listas.',
          },
          {
            role: 'user',
            content: statsLines.join('\n'),
          },
        ],
        max_tokens: 130,
        temperature: 0.25,
      },
      gatewayConfig
    );

    const rawText = typeof aiResult.response === 'string' ? aiResult.response.trim() : '';
    const cleaned = rawText.replace(/^["'«»]+|["'«»]+$/g, '').replace(/\s+/g, ' ').trim();
    if (cleaned.length >= 12) {
      insightText = cleaned;
      fromAi = true;
    }
  } catch {
    fromAi = false;
  }

  const responsePayload = {
    month,
    insight: insightText,
    fromAi,
    cached: false,
    expenseCount,
  };

  if (fromAi) {
    try {
      if (typeof caches !== 'undefined' && caches.default) {
        const cacheResponse = new Response(JSON.stringify(responsePayload), {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': `public, max-age=${INSIGHT_CACHE_TTL_SECONDS}`,
          },
        });
        await caches.default.put(cacheReq, cacheResponse);
      }
    } catch {
      // Ignore Cache API write errors
    }
  }

  return c.json(responsePayload);
});
