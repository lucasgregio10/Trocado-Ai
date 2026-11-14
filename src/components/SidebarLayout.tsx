import React from 'react';
import {
  LayoutGrid,
  ReceiptText,
  Sparkles,
  BarChart3,
  Wallet,
  Settings,
  Plus,
  Sun,
  Moon,
  Search,
  Calendar,
  LogOut,
} from 'lucide-react';
import { ActiveView, Profile } from '../types/finance';
import { TrocadoLogo, SafeImage } from './TrocadoLogo';
import { getCurrentMonthSaoPaulo } from '../utils/formatters';
import { PWAInstallButton } from './PWAInstallButton';

interface SidebarLayoutProps {
  activeView: ActiveView;
  profile: Profile | null;
  onNavigate: (view: ActiveView) => void;
  onOpenNewExpense: () => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onQuickSearch: () => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{
  id: ActiveView;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'expenses', label: 'Despesas', icon: ReceiptText },
  { id: 'assistant', label: 'Assistente IA', icon: Sparkles },
  { id: 'reports', label: 'Relatórios', icon: BarChart3 },
  { id: 'budgets', label: 'Orçamentos', icon: Wallet },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

const VIEW_TITLES: Record<ActiveView, string> = {
  dashboard: 'Visão Geral',
  expenses: 'Todas as Despesas',
  assistant: 'Assistente IA',
  reports: 'Relatórios & Tendências',
  budgets: 'Orçamentos & Metas',
  settings: 'Configurações',
};

export function SidebarLayout({
  activeView,
  profile,
  onNavigate,
  onOpenNewExpense,
  isDark,
  onToggleTheme,
  onQuickSearch,
  onSignOut,
  children,
}: SidebarLayoutProps) {
  const currentMonth = getCurrentMonthSaoPaulo();
  const displayName = profile?.displayName || 'Minha Conta';
  const email = profile?.email || 'Não autenticado';

  return (
    <div className="min-h-screen flex bg-[#F8FAFC] dark:bg-[#0B0F14] text-slate-900 dark:text-[#E0E2EA] transition-colors duration-200">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 border-r border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#101419] z-30">
        <div className="h-16 px-6 flex items-center gap-3 border-b border-slate-200 dark:border-[#222C38]">
          <TrocadoLogo className="w-8 h-8 shrink-0" />
          <span className="text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
            Trocado
          </span>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Navegação principal">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
                  active
                    ? item.id === 'assistant'
                      ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
                      : 'bg-emerald-500/15 text-emerald-700 dark:text-[#4EDEA3]'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#181C21] hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-[#222C38] space-y-2">
          <button
            type="button"
            onClick={() => onNavigate('settings')}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-[#181C21] transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <SafeImage
              src={null}
              alt={displayName}
              className="w-9 h-9 rounded-full object-cover shrink-0 border border-slate-200 dark:border-[#222C38]"
              fallbackType="avatar"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                {displayName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {email}
              </p>
            </div>
          </button>

          <PWAInstallButton />

          <button
            type="button"
            onClick={onSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 h-16 bg-white/90 dark:bg-[#0B0F14]/90 backdrop-blur-md border-b border-slate-200 dark:border-[#222C38] px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="lg:hidden flex items-center gap-2 shrink-0">
              <TrocadoLogo className="w-7 h-7" />
              <span className="font-bold text-base text-slate-900 dark:text-white">Trocado</span>
            </div>
            <div className="hidden lg:flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 min-w-0">
              <span className="font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                {VIEW_TITLES[activeView]}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                {currentMonth.label}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onQuickSearch}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#151B23] text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label="Buscar despesas"
            >
              <Search className="w-3.5 h-3.5" />
              <span>Buscar despesas</span>
              <span className="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">⌘K</span>
            </button>

            <button
              type="button"
              onClick={onToggleTheme}
              className="p-2 rounded-lg border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1C2025] transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              aria-label={isDark ? 'Ativar modo claro' : 'Ativar modo escuro'}
              title={isDark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-700" />}
            </button>

            <button
              type="button"
              onClick={onOpenNewExpense}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-sm transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
            >
              <Plus className="w-4 h-4 shrink-0" />
              <span>Nova Despesa</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-24 lg:pb-10 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 h-16 bg-white/95 dark:bg-[#101419]/95 backdrop-blur-md border-t border-slate-200 dark:border-[#222C38] flex items-center justify-around px-2"
        aria-label="Menu inferior"
      >
        {[
          { id: 'dashboard' as ActiveView, label: 'Início', icon: LayoutGrid },
          { id: 'expenses' as ActiveView, label: 'Despesas', icon: ReceiptText },
          { id: 'assistant' as ActiveView, label: 'Assistente', icon: Sparkles },
          { id: 'budgets' as ActiveView, label: 'Metas', icon: Wallet },
          { id: 'settings' as ActiveView, label: 'Ajustes', icon: Settings },
        ].map((item) => {
          const Icon = item.icon;
          const active = activeView === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              className={`flex flex-col items-center justify-center gap-0.5 min-w-[56px] min-h-[44px] text-[11px] font-medium transition-colors ${
                active
                  ? 'text-emerald-600 dark:text-[#4EDEA3]'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
