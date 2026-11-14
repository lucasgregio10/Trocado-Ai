import { Hono } from 'hono';
import { getSupabaseClient } from '../lib/supabase';
import type { AppContextEnv } from '../types';

const MAX_RECEIPT_BYTES = 2 * 1024 * 1024; // 2 MB

export const receiptsRoutes = new Hono<AppContextEnv>();

receiptsRoutes.put('/expenses/:id/receipt', async (c) => {
  if (c.env.RECEIPTS_ENABLED !== 'true' || !c.env.RECEIPTS) {
    return c.json({ error: 'Armazenamento de comprovantes desabilitado.' }, 404);
  }

  const userId = c.get('userId');
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c);

  const { data: existing, error: findErr } = await supabase
    .from('expenses')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle<{ id: string }>();

  if (findErr) {
    console.error('[Receipt Lookup Error]', findErr.code);
    return c.json({ error: 'Não foi possível salvar o comprovante.' }, 500);
  }

  if (!existing) {
    return c.json({ error: 'Despesa não encontrada.' }, 404);
  }

  const contentType = (c.req.header('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (!contentType.startsWith('image/')) {
    return c.json({ error: 'Envie um arquivo de imagem válido.' }, 400);
  }

  const contentLengthHeader = c.req.header('Content-Length');
  if (contentLengthHeader) {
    const length = Number.parseInt(contentLengthHeader, 10);
    if (!Number.isFinite(length) || length <= 0) {
      return c.json({ error: 'Arquivo de imagem inválido.' }, 400);
    }
    if (length > MAX_RECEIPT_BYTES) {
      return c.json({ error: 'A imagem do comprovante excede o limite de 2 MB.' }, 413);
    }
  }

  const bodyStream = c.req.raw.body;
  if (!bodyStream) {
    return c.json({ error: 'Corpo da imagem ausente.' }, 400);
  }

  const receiptKey = `${userId}/${id}.jpg`;

  const stored = await c.env.RECEIPTS.put(receiptKey, bodyStream, {
    httpMetadata: { contentType },
  });

  if (stored && stored.size > MAX_RECEIPT_BYTES) {
    await c.env.RECEIPTS.delete(receiptKey).catch(() => {});
    return c.json({ error: 'A imagem do comprovante excede o limite de 2 MB.' }, 413);
  }

  const now = new Date().toISOString();
  const { error: updateErr } = await supabase
    .from('expenses')
    .update({ receipt_key: receiptKey, updated_at: now })
    .eq('id', id)
    .eq('user_id', userId);

  if (updateErr) {
    console.error('[Receipt Key Update Error]', updateErr.code);
    return c.json({ error: 'Não foi possível vincular o comprovante à despesa.' }, 500);
  }

  return c.json({ receiptKey });
});

receiptsRoutes.get('/expenses/:id/receipt', async (c) => {
  if (c.env.RECEIPTS_ENABLED !== 'true' || !c.env.RECEIPTS) {
    return c.json({ error: 'Armazenamento de comprovantes desabilitado.' }, 404);
  }

  const userId = c.get('userId');
  const id = c.req.param('id');
  const supabase = getSupabaseClient(c);

  const { data: row, error: findErr } = await supabase
    .from('expenses')
    .select('receipt_key')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle<{ receipt_key: string | null }>();

  if (findErr) {
    console.error('[Receipt Fetch Error]', findErr.code);
    return c.json({ error: 'Não foi possível carregar o comprovante.' }, 500);
  }

  if (!row || !row.receipt_key) {
    return c.json({ error: 'Comprovante não encontrado.' }, 404);
  }

  const obj = await c.env.RECEIPTS.get(row.receipt_key);
  if (!obj) {
    return c.json({ error: 'Comprovante não encontrado.' }, 404);
  }

  return new Response(obj.body, {
    status: 200,
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'image/jpeg',
      'Cache-Control': 'private, max-age=3600',
    },
  });
});
