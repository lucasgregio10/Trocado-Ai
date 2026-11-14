import { Hono } from 'hono';

export interface Env {
  DB: D1Database;
  AI: Ai;
  RECEIPTS?: R2Bucket;
  SUPABASE_URL: string;
  AI_GATEWAY_ID: string;
  RECEIPTS_ENABLED: string;
  AI_DAILY_LIMIT_PER_USER: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => {
  return c.json({ ok: true });
});

app.all('/api/*', (c) => {
  return c.json({ error: 'Rota da API não encontrada.' }, 404);
});

app.onError((_err, c) => {
  return c.json({ error: 'Erro interno do servidor.' }, 500);
});

export default app;
