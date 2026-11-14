import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getTurnstileSiteKey } from '../../lib/env';
import { AuthLayout } from './AuthLayout';
import { TurnstileWidget } from './TurnstileWidget';

interface LoginViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export function LoginView({ isDark, onToggleTheme }: LoginViewProps) {
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasTurnstile = Boolean(getTurnstileSiteKey());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Preencha e-mail e senha para entrar.');
      return;
    }

    if (hasTurnstile && !captchaToken) {
      setError('Confirme a verificação de segurança antes de continuar.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email, password, captchaToken ?? undefined);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'E-mail ou senha incorretos');
      if (hasTurnstile) {
        setTurnstileResetKey((k) => k + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Entrar no Trocado"
      subtitle="Acesse seu controle financeiro pessoal e acompanhe suas despesas."
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      footer={
        <span>
          Ainda não tem uma conta?{' '}
          <Link
            to="/cadastro"
            className="font-semibold text-emerald-600 dark:text-[#4EDEA3] hover:underline"
          >
            Criar conta
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-600 dark:text-red-300"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <div>
          <label
            htmlFor="login-email"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
          >
            E-mail
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="voce@exemplo.com"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login-password"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300"
            >
              Senha
            </label>
            <Link
              to="/esqueci-senha"
              className="text-xs font-medium text-emerald-600 dark:text-[#4EDEA3] hover:underline"
            >
              Esqueci minha senha
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="login-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Sua senha"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <TurnstileWidget
          isDark={isDark}
          resetKey={turnstileResetKey}
          onToken={setCaptchaToken}
        />

        <button
          type="submit"
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-[#0B0F14] font-semibold text-sm transition-colors cursor-pointer"
        >
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          <span>{submitting ? 'Entrando...' : 'Entrar'}</span>
        </button>
      </form>
    </AuthLayout>
  );
}
