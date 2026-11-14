import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Context } from 'hono';
import type { AppContextEnv } from '../types';

export function getSupabaseClient(c: Context<AppContextEnv>): SupabaseClient {
  const supabaseUrl = c.env.SUPABASE_URL?.trim();
  const publishableKey = c.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const accessToken = c.get('accessToken');

  if (!supabaseUrl || !publishableKey) {
    throw new Error('Configuração do Supabase ausente no servidor.');
  }

  return createClient(supabaseUrl, publishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export async function incrementDailyAiUsage(
  supabase: SupabaseClient,
  userId: string,
  dayISO: string
): Promise<number> {
  const { data: rpcCalls, error: rpcError } = await supabase.rpc('increment_ai_usage', {
    p_day: dayISO,
  });

  if (!rpcError && typeof rpcCalls === 'number') {
    return rpcCalls;
  }

  // Fallback if increment_ai_usage RPC is not installed yet
  const { data: existing, error: readError } = await supabase
    .from('ai_usage')
    .select('calls')
    .eq('user_id', userId)
    .eq('day', dayISO)
    .maybeSingle();

  if (readError) {
    throw readError;
  }

  const nextCalls = (existing?.calls ?? 0) + 1;
  const { error: upsertError } = await supabase
    .from('ai_usage')
    .upsert({ user_id: userId, day: dayISO, calls: nextCalls }, { onConflict: 'user_id,day' });

  if (upsertError) {
    throw upsertError;
  }

  return nextCalls;
}
