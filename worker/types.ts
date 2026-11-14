export interface Env {
  AI: Ai;
  RECEIPTS?: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY?: string;
  AI_GATEWAY_ID: string;
  RECEIPTS_ENABLED: string;
  AI_DAILY_LIMIT_PER_USER: string;
}

export interface AuthVariables {
  userId: string;
  userEmail: string;
  userMetadata: Record<string, unknown>;
  accessToken: string;
}

export type AppContextEnv = {
  Bindings: Env;
  Variables: AuthVariables;
};
