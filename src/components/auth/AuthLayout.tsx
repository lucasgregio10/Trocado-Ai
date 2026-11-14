import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { TrocadoLogo } from '../TrocadoLogo';

interface AuthLayoutProps {
  title: string;
  subtitle: string;
  isDark: boolean;
  onToggleTheme: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthLayout({
  title,
  subtitle,
  isDark,
  onToggleTheme,
  children,
  footer,
}: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#F8FAFC] dark:bg-[#0B0F14] text-slate-900 dark:text-[#E0E2EA] transition-colors duration-200 relative overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 80% 10%, rgba(16, 185, 129, 0.12), transparent 45%), radial-gradient(circle at 15% 85%, rgba(139, 92, 246, 0.10), transparent 45%)',
        }}
        aria-hidden="true"
      />

      <header className="relative z-10 w-full max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TrocadoLogo className="w-8 h-8 shrink-0" />
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">
            Trocado
          </span>
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          className="p-2 rounded-lg border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1C2025] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
          title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        >
          {isDark ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 sm:p-8 shadow-xl shadow-slate-900/5 dark:shadow-black/40">
          <div className="mb-6">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {title}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
              {subtitle}
            </p>
          </div>

          {children}

          {footer && (
            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-[#222C38] text-center text-xs text-slate-500 dark:text-slate-400">
              {footer}
            </div>
          )}
        </div>
      </main>

      <footer className="relative z-10 py-4 text-center text-xs text-slate-400 dark:text-slate-500">
        Trocado · Assistente financeiro pessoal
      </footer>
    </div>
  );
}
