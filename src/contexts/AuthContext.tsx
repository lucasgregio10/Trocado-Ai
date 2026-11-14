import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export interface SignUpParams {
  name: string;
  email: string;
  password: string;
  captchaToken?: string;
}

export interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signIn: (email: string, password: string, captchaToken?: string) => Promise<void>;
  signUp: (params: SignUpParams) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string, captchaToken?: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function translateAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return 'E-mail ou senha incorretos';
  }
  if (lower.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de entrar';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'Este e-mail já está cadastrado';
  }
  if (lower.includes('password should be at least') || lower.includes('weak password')) {
    return 'A senha não atende aos requisitos mínimos de segurança';
  }
  if (lower.includes('unable to validate email address') || lower.includes('invalid email')) {
    return 'Informe um endereço de e-mail válido';
  }
  if (lower.includes('captcha') || lower.includes('turnstile')) {
    return 'Falha na verificação de segurança. Marque a caixa novamente e tente outra vez.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests') || lower.includes('over_email_send_rate_limit')) {
    return 'Muitas tentativas seguidas. Aguarde alguns instantes e tente novamente.';
  }
  if (lower.includes('new password should be different from the old password')) {
    return 'A nova senha deve ser diferente da senha anterior.';
  }
  if (lower.includes('auth session missing') || lower.includes('session missing')) {
    return 'Link de recuperação inválido ou expirado. Solicite um novo link.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'Não foi possível conectar ao servidor de autenticação.';
  }

  return message || 'Não foi possível concluir a operação. Tente novamente.';
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.location.hash.includes('type=recovery');
  });

  useEffect(() => {
    let active = true;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return;
        setSession(data.session ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession ?? null);
      setLoading(false);

      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      } else if (event === 'SIGNED_OUT') {
        setIsPasswordRecovery(false);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const clearPasswordRecovery = useCallback(() => {
    setIsPasswordRecovery(false);
  }, []);

  const signIn = useCallback(async (email: string, password: string, captchaToken?: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
      options: captchaToken ? { captchaToken } : undefined,
    });
    if (error) {
      throw new Error(translateAuthError(error.message));
    }
  }, []);

  const signUp = useCallback(async ({ name, email, password, captchaToken }: SignUpParams) => {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: name.trim(),
        },
        emailRedirectTo: `${window.location.origin}/login`,
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    if (error) {
      throw new Error(translateAuthError(error.message));
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsPasswordRecovery(false);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        await supabase.auth.signOut({ scope: 'local' });
      }
    } catch {
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    } finally {
      setSession(null);
    }
  }, []);

  const resetPassword = useCallback(async (email: string, captchaToken?: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/redefinir-senha`,
      ...(captchaToken ? { captchaToken } : {}),
    });
    if (error) {
      throw new Error(translateAuthError(error.message));
    }
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      throw new Error(translateAuthError(error.message));
    }
    setIsPasswordRecovery(false);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      isPasswordRecovery,
      clearPasswordRecovery,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
    }),
    [
      session,
      loading,
      isPasswordRecovery,
      clearPasswordRecovery,
      signIn,
      signUp,
      signOut,
      resetPassword,
      updatePassword,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser utilizado dentro de um AuthProvider.');
  }
  return ctx;
}
