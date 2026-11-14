import { createMiddleware } from 'hono/factory';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AppContextEnv } from '../types';

let cachedJwksUrl: string | null = null;
let cachedJwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwks(supabaseUrl: string) {
  const normalized = supabaseUrl.replace(/\/+$/, '');
  const jwksUrl = `${normalized}/auth/v1/.well-known/jwks.json`;

  if (!cachedJwks || cachedJwksUrl !== jwksUrl) {
    cachedJwks = createRemoteJWKSet(new URL(jwksUrl));
    cachedJwksUrl = jwksUrl;
  }

  return {
    jwks: cachedJwks,
    issuer: `${normalized}/auth/v1`,
  };
}

export const requireAuth = createMiddleware<AppContextEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Sessão expirada. Entre novamente.' }, 401);
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return c.json({ error: 'Sessão expirada. Entre novamente.' }, 401);
  }

  const supabaseUrl = c.env.SUPABASE_URL?.trim();
  if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
    return c.json({ error: 'Configuração de autenticação inválida no servidor.' }, 500);
  }

  try {
    const { jwks, issuer } = getJwks(supabaseUrl);
    const { payload } = await jwtVerify(token, jwks, {
      issuer,
      audience: 'authenticated',
    });

    if (!payload.sub || typeof payload.sub !== 'string') {
      return c.json({ error: 'Sessão expirada. Entre novamente.' }, 401);
    }

    const email = typeof payload.email === 'string' ? payload.email : '';
    const userMetadata =
      payload.user_metadata && typeof payload.user_metadata === 'object'
        ? (payload.user_metadata as Record<string, unknown>)
        : {};

    c.set('userId', payload.sub);
    c.set('userEmail', email);
    c.set('userMetadata', userMetadata);
    c.set('accessToken', token);

    await next();
  } catch {
    return c.json({ error: 'Sessão expirada. Entre novamente.' }, 401);
  }
});
