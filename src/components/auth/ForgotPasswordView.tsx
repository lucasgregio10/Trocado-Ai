import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getTurnstileSiteKey } from '../../lib/env';
import { AuthLayout } from './AuthLayout';
import { TurnstileWidget } from './TurnstileWidget';

interface ForgotPasswordViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export function ForgotPasswordView({ isDark, onToggleTheme }: ForgotPasswordViewProps) {
  const { resetPassword } = useAuth();

  const [email, setEmail] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const hasTurnstile = Boolean(getTurnstileSiteKey());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError('Informe o e-mail da sua conta.');
      return;
    }

    if (hasTurnstile && !captchaToken) {
      setError('Confirme a verificação de segurança antes de continuar.');
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(email, captchaToken ?? undefined);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o e-mail de recuperação.');
      if (hasTurnstile) {
        setTurnstileResetKey((k) => k + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Recuperar senha"
      subtitle="Informe seu e-mail para receber um link de redefinição de senha."
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      footer={
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 font-semibold text-emerald-600 dark:text-[#4EDEA3] hover:underline"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Voltar para o login
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-3">
          <div className="w-11 h-11 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Link de recuperação enviado
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Se existir uma conta para <span className="font-semibold">{email.trim()}</span>, você receberá um e-mail com instruções para criar uma nova senha.
          </p>
        </div>
      ) : (
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
              htmlFor="forgot-email"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
            >
              E-mail cadastrado
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="forgot-email"
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
            <span>{submitting ? 'Enviando...' : 'Enviar link de recuperação'}</span>
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
