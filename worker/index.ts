import { Hono } from 'hono';
import { requireAuth } from './middleware/auth';
import { meRoutes } from './routes/me';
import { expensesRoutes } from './routes/expenses';
import { dashboardRoutes } from './routes/dashboard';
import { aiRoutes } from './routes/ai';
import { receiptsRoutes } from './routes/receipts';
import { reportsRoutes } from './routes/reports';
import { budgetsRoutes } from './routes/budgets';
import { categoriesRoutes } from './routes/categories';
import { insightsRoutes } from './routes/insights';
import { assistantRoutes } from './routes/assistant';
import { accountRoutes } from './routes/account';
import type { AppContextEnv, Env } from './types';

export type { Env };

const MAX_API_BODY_BYTES = 2 * 1024 * 1024; // 2 MB

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=()',
  'X-Frame-Options': 'DENY',
};

function applySecurityHeaders(headers: Headers) {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    headers.set(key, value);
  }
}

const app = new Hono<AppContextEnv>();

// Security headers for all /api/* responses (without CSP)
app.use('/api/*', async (c, next) => {
  await next();
  applySecurityHeaders(c.res.headers);
});

// Request size limit (2 MB except receipt binary upload) and strict Content-Type checks
app.use('/api/*', async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  const isReceiptUpload =
    method === 'PUT' && /^\/api\/expenses\/[^/]+\/receipt$/.test(c.req.path);

  const contentType = (c.req.header('Content-Type') || '').split(';')[0].trim().toLowerCase();

  if (isReceiptUpload) {
    if (!contentType.startsWith('image/')) {
      return c.json({ error: 'Tipo de conteúdo inválido. Envie um arquivo de imagem.' }, 415);
    }
    return next();
  }

  const contentLengthHeader = c.req.header('Content-Length');
  const hasBodyContentLength = contentLengthHeader !== undefined && Number(contentLengthHeader) > 0;

  if (contentLengthHeader) {
    const declaredLength = Number.parseInt(contentLengthHeader, 10);
    if (!Number.isFinite(declaredLength) || declaredLength < 0) {
      return c.json({ error: 'Cabeçalho Content-Length inválido.' }, 400);
    }
    if (declaredLength > MAX_API_BODY_BYTES) {
      return c.json({ error: 'O corpo da requisição excede o limite de 2 MB.' }, 413);
    }
  }

  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    if (contentType !== 'application/json') {
      return c.json({ error: 'Content-Type inválido. Utilize application/json.' }, 415);
    }
  } else if (method === 'DELETE' && (hasBodyContentLength || contentType)) {
    if (contentType !== 'application/json') {
      return c.json({ error: 'Content-Type inválido. Utilize application/json.' }, 415);
    }
  }

  if (method === 'POST' || method === 'PUT' || method === 'PATCH' || (method === 'DELETE' && hasBodyContentLength)) {
    try {
      const clonedBuffer = await c.req.raw.clone().arrayBuffer();
      if (clonedBuffer.byteLength > MAX_API_BODY_BYTES) {
        return c.json({ error: 'O corpo da requisição excede o limite de 2 MB.' }, 413);
      }
    } catch (err) {
      console.error(
        '[Request Body Inspection Error]',
        c.req.method,
        c.req.path,
        err instanceof Error ? err.message : 'Failed to inspect body'
      );
      return c.json({ error: 'Corpo da requisição inválido.' }, 400);
    }
  }

  return next();
});

app.get('/api/health', (c) => {
  return c.json({ ok: true });
});

app.use('/api/*', async (c, next) => {
  if (c.req.path === '/api/health') {
    return next();
  }
  return requireAuth(c, next);
});

app.route('/api', meRoutes);
app.route('/api', expensesRoutes);
app.route('/api', dashboardRoutes);
app.route('/api', aiRoutes);
app.route('/api', receiptsRoutes);
app.route('/api', reportsRoutes);
app.route('/api', budgetsRoutes);
app.route('/api', categoriesRoutes);
app.route('/api', insightsRoutes);
app.route('/api', assistantRoutes);
app.route('/api', accountRoutes);

app.all('/api/*', (c) => {
  return c.json({ error: 'Rota da API não encontrada.' }, 404);
});

app.onError((err, c) => {
  console.error(
    '[Worker Unhandled Error]',
    c.req.method,
    c.req.path,
    err instanceof Error ? err.message : 'Unknown error'
  );
  const res = c.json({ error: 'Erro interno do servidor.' }, 500);
  applySecurityHeaders(res.headers);
  return res;
});

export default app;
