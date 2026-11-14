import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseClient } from '../lib/supabase';
import type { AppContextEnv } from '../types';

const deleteAccountSchema = z.object({
  confirmation: z
    .string({ message: 'Confirmação obrigatória.' })
    .trim()
    .refine((v) => v === 'EXCLUIR', {
      message: 'Digite EXCLUIR para confirmar a exclusão permanente da conta.',
    }),
});

export const accountRoutes = new Hono<AppContextEnv>();

accountRoutes.delete('/account', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseClient(c);

  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json(
      { error: 'Digite EXCLUIR para confirmar a exclusão permanente da conta.' },
      400
    );
  }

  const parsed = deleteAccountSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json(
      {
        error:
          parsed.error.issues[0]?.message ||
          'Digite EXCLUIR para confirmar a exclusão permanente da conta.',
      },
      400
    );
  }

  // Delete all R2 receipt objects under userId/ prefix
  if (c.env.RECEIPTS) {
    try {
      let cursor: string | undefined;
      do {
        const listed = await c.env.RECEIPTS.list({
          prefix: `${userId}/`,
          cursor,
        });
        if (listed.objects.length > 0) {
          const keys = listed.objects.map((obj) => obj.key);
          await c.env.RECEIPTS.delete(keys);
        }
        cursor = listed.truncated ? listed.cursor : undefined;
      } while (cursor);
    } catch (err) {
      console.error(
        '[Account Delete R2 Error]',
        err instanceof Error ? err.message : 'R2 cleanup failed'
      );
      return c.json({ error: 'Não foi possível excluir os arquivos da conta.' }, 500);
    }
  }

  // Delete all user records in Supabase in FK-safe order
  const deleteOps = [
    await supabase.from('expenses').delete().eq('user_id', userId),
    await supabase.from('budgets').delete().eq('user_id', userId),
    await supabase.from('categories').delete().eq('user_id', userId),
    await supabase.from('ai_usage').delete().eq('user_id', userId),
    await supabase.from('profiles').delete().eq('user_id', userId),
  ];

  const failedOp = deleteOps.find((op) => op.error);
  if (failedOp?.error) {
    console.error('[Account Delete Supabase DB Error]', failedOp.error.code);
    return c.json({ error: 'Não foi possível excluir todos os dados da conta.' }, 500);
  }

  let authDeleted = false;
  const secretKey = c.env.SUPABASE_SECRET_KEY?.trim();
  const supabaseUrl = c.env.SUPABASE_URL?.trim().replace(/\/+$/, '');

  if (secretKey && supabaseUrl) {
    try {
      const adminResp = await fetch(
        `${supabaseUrl}/auth/v1/admin/users/${encodeURIComponent(userId)}`,
        {
          method: 'DELETE',
          headers: {
            apikey: secretKey,
            Authorization: `Bearer ${secretKey}`,
          },
        }
      );

      if (adminResp.ok || adminResp.status === 404) {
        authDeleted = true;
      } else {
        console.error('[Account Delete Supabase Admin Error]', adminResp.status);
      }
    } catch (err) {
      console.error(
        '[Account Delete Supabase Request Error]',
        err instanceof Error ? err.message : 'Admin API call failed'
      );
    }
  }

  return c.json({ ok: true, authDeleted });
});
