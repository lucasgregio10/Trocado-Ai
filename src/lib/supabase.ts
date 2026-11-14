import { createClient } from '@supabase/supabase-js';
import { getClientEnv } from './env';

const { supabaseUrl, supabasePublishableKey } = getClientEnv();

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
