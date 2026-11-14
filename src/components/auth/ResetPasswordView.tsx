import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2, Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { AuthLayout } from './AuthLayout';
import { evaluatePassword, PasswordStrengthMeter } from './PasswordStrengthMeter';

interface ResetPasswordViewProps {
  isDark: boolean;
  onToggleTheme: () => void;
}

export function ResetPasswordView({ isDark, onToggleTheme }: ResetPasswordViewProps) {
  const { session, loading, isPasswordRecovery, updatePassword } = useAuth();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canReset = Boolean(session || isPasswordRecovery);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const pwCheck = evaluatePassword(password);
    if (!pwCheck.isValid) {
      setError('A nova senha deve ter no mínimo 8 caracteres, com letras e números.');
      return;
    }

    if (password !== confirmPassword) {
      setError('A confirmação de senha não confere.');
      return;
    }

    setSubmitting(true);
    try {
      await updatePassword(password);
      setSuccess(true);
      setTimeout(() => {
        navigate('/', { replace: true });
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível atualizar a senha.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout
      title="Redefinir senha"
      subtitle="Escolha uma nova senha segura para acessar sua conta."
      isDark={isDark}
      onToggleTheme={onToggleTheme}
      footer={
        <Link
          to="/login"
          className="font-semibold text-emerald-600 dark:text-[#4EDEA3] hover:underline"
        >
          Voltar para o login
        </Link>
      }
    >
      {loading ? (
        <div className="py-8 flex flex-col items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
          <span>Validando link de recuperação...</span>
        </div>
      ) : success ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-center space-y-2.5">
          <div className="w-11 h-11 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Senha atualizada com sucesso!
          </p>
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Redirecionando para o painel...
          </p>
        </div>
      ) : !canReset ? (
        <div className="space-y-4">
          <div
            role="alert"
            className="flex items-start gap-2.5 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              Este link de recuperação expirou ou é inválido. Solicite um novo link para redefinir sua senha.
            </span>
          </div>
          <Link
            to="/esqueci-senha"
            className="w-full inline-flex items-center justify-center py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-sm transition-colors"
          >
            Solicitar novo link
          </Link>
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
              htmlFor="reset-password"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Nova senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="reset-password"
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
              htmlFor="reset-confirm-password"
              className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1.5"
            >
              Confirmar nova senha
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                id="reset-confirm-password"
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete="new-password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
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

          <button
            type="submit"
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-[#0B0F14] font-semibold text-sm transition-colors cursor-pointer"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{submitting ? 'Salvando...' : 'Salvar nova senha'}</span>
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
