import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  User,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getTurnstileSiteKey } from '../../lib/env';
import { AuthLayout } from './AuthLayout';
import { evaluatePassword, PasswordStrengthMeter } from './PasswordStrengthMeter';
import { TurnstileWidget } from './TurnstileWidget';

interface RegisterViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export function RegisterView({ isDark, onToggleTheme }: RegisterViewProps) {
  const { signUp } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);

  const hasTurnstile = Boolean(getTurnstileSiteKey());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Informe seu nome completo.');
      return;
    }

    if (!email.trim()) {
      setError('Informe seu endereço de e-mail.');
      return;
    }

    const pwCheck = evaluatePassword(password);
    if (!pwCheck.isValid) {
      setError('A senha deve ter no mínimo 8 caracteres, incluindo letras e números.');
      return;
    }

    if (password !== confirmPassword) {
      setError('A confirmação de senha não confere.');
      return;
    }

    if (!acceptTerms) {
      setError('Você precisa aceitar os termos de uso para criar sua conta.');
      return;
    }

    if (hasTurnstile && !captchaToken) {
      setError('Confirme a verificação de segurança antes de continuar.');
      return;
    }

    setSubmitting(true);
    try {
      await signUp({
        name: name.trim(),
        email: email.trim(),
        password,
        captchaToken: captchaToken ?? undefined,
      });
      setRegisteredEmail(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar sua conta.');
      if (hasTurnstile) {
        setTurnstileResetKey((k) => k + 1);
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (registeredEmail) {
    return (
      <AuthLayout
        title="Confirme seu e-mail"
        subtitle="Falta apenas um passo para ativar sua conta no Trocado."
        isDark={isDark}
        onToggleTheme={onToggleTheme}
        footer={
          <Link
            to="/login"
            className="font-semibold text-emerald-600 dark:text-[#4EDEA3] hover:underline"
          >
            Ir para o login
          </Link>
        }
      >
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-3">
          <div className="w-11 h-11 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Enviamos um link de confirmação para seu e-mail
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Verifique a caixa de entrada (e spam) de{' '}
            <span className="font-semibold text-slate-900 dark:text-white">{registeredEmail}</span>{' '}
            e clique no link para entrar no Trocado.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Organize seus gastos com facilidade e segurança."
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      footer={
        <span>
          Já possui uma conta?{' '}
          <Link
            to="/login"
            className="font-semibold text-emerald-600 dark:text-[#4EDEA3] hover:underline"
          >
            Entrar
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
            htmlFor="register-name"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
          >
            Nome
          </label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="register-name"
              type="text"
              autoComplete="name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome"
              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="register-email"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
          >
            E-mail
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="register-email"
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
          <label
            htmlFor="register-password"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
          >
            Senha
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="register-password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 8 caracteres"
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
          <PasswordStrengthMeter password={password} />
        </div>

        <div>
          <label
            htmlFor="register-confirm-password"
            className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
          >
            Confirmar senha
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="register-confirm-password"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita sua senha"
              className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
              aria-label={showConfirmPassword ? 'Ocultar confirmação' : 'Mostrar confirmação'}
            >
              {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <label className="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none pt-1">
          <input
            type="checkbox"
            checked={acceptTerms}
            onChange={(e) => setAcceptTerms(e.target.checked)}
            className="mt-0.5 rounded border-slate-300 dark:border-[#222C38] text-emerald-500 focus:ring-emerald-500"
          />
          <span className="leading-relaxed">
            Li e aceito os termos de uso e a política de privacidade para armazenamento dos meus registros financeiros.
          </span>
        </label>

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
          <span>{submitting ? 'Criando conta...' : 'Criar conta'}</span>
        </button>
      </form>
    </AuthLayout>
  );
}
