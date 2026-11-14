import React, { useEffect, useState } from 'react';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, X } from 'lucide-react';
import { ActiveView, Budget, Category, Expense, Profile } from './types/finance';
import { SidebarLayout } from './components/SidebarLayout';
import { DashboardView } from './components/DashboardView';
import { ExpensesView } from './components/ExpensesView';
import { AssistantView } from './components/AssistantView';
import { BudgetsView } from './components/BudgetsView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { NewExpenseModal } from './components/NewExpenseModal';
import { ExpenseDetailModal } from './components/ExpenseDetailModal';
import { apiFetch } from './lib/api';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const VIEW_PATHS: Record<ActiveView, string> = {
  dashboard: '/',
  expenses: '/despesas',
  assistant: '/assistente',
  reports: '/relatorios',
  budgets: '/orcamentos',
  settings: '/configuracoes',
};

function pathToView(pathname: string): ActiveView {
  switch (pathname) {
    case '/despesas':
      return 'expenses';
    case '/assistente':
      return 'assistant';
    case '/relatorios':
      return 'reports';
    case '/orcamentos':
      return 'budgets';
    case '/configuracoes':
      return 'settings';
    default:
      return 'dashboard';
  }
}

function TrocadoAppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeView = pathToView(location.pathname);

  const [isDark, setIsDark] = useState<boolean>(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);

  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
  const [newExpenseMode, setNewExpenseMode] = useState<'foto' | 'texto' | 'manual'>('foto');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Check Worker API health cleanly via TanStack Query
  useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<{ ok: boolean }>('/api/health', { skipAuth: true }),
    retry: false,
  });

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        navigate(VIEW_PATHS.expenses);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleNavigate = (view: ActiveView) => {
    navigate(VIEW_PATHS[view]);
  };

  const openNewExpense = (mode: 'foto' | 'texto' | 'manual' = 'foto') => {
    setNewExpenseMode(mode);
    setIsNewExpenseOpen(true);
  };

  const handleSaveNewExpense = (draft: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => {
    const now = new Date().toISOString();
    const created: Expense = {
      ...draft,
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    setExpenses((prev) => [created, ...prev]);
    setIsNewExpenseOpen(false);
    setToast('Despesa salva!');
  };

  const handleUpdateExpense = (updated: Expense) => {
    setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setSelectedExpense(updated);
    setToast('Despesa atualizada!');
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setToast('Despesa removida.');
  };

  const handleUpdateBudgetLimit = (categoryId: string, newLimitCents: number) => {
    setBudgets((prev) => {
      const exists = prev.some((b) => b.categoryId === categoryId);
      if (exists) {
        return prev.map((b) =>
          b.categoryId === categoryId ? { ...b, monthlyLimitCents: newLimitCents } : b
        );
      }
      const cat = categories.find((c) => c.id === categoryId);
      if (!cat) return prev;
      return [
        ...prev,
        {
          categoryId,
          categoryName: cat.name,
          categoryColor: cat.color,
          categoryIcon: cat.icon,
          monthlyLimitCents: newLimitCents,
          spentCents: 0,
        },
      ];
    });
  };

  const handleAddCategory = (name: string, color: string) => {
    const created: Category = {
      id: crypto.randomUUID(),
      name,
      color,
      icon: 'tag',
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    setCategories((prev) => [...prev, created]);
    setToast(`Categoria "${name}" criada!`);
  };

  const handleDeleteCategory = (id: string) => {
    setCategories((prev) => prev.filter((c) => c.id !== id));
    setToast('Categoria removida.');
  };

  const handleUpdateDisplayName = (displayName: string) => {
    setProfile((prev) =>
      prev
        ? { ...prev, displayName }
        : {
            userId: '',
            email: '',
            displayName,
            theme: isDark ? 'dark' : 'light',
            createdAt: new Date().toISOString(),
          }
    );
    setToast('Perfil atualizado!');
  };

  return (
    <>
      <SidebarLayout
        activeView={activeView}
        profile={profile}
        onNavigate={handleNavigate}
        onOpenNewExpense={() => openNewExpense('foto')}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        onQuickSearch={() => handleNavigate('expenses')}
      >
        <Routes>
          <Route
            path="/"
            element={
              <DashboardView
                profile={profile}
                expenses={expenses}
                budgets={budgets}
                categories={categories}
                onNavigate={handleNavigate}
                onOpenNewExpense={openNewExpense}
                onSelectExpense={setSelectedExpense}
              />
            }
          />
          <Route
            path="/despesas"
            element={
              <ExpensesView
                expenses={expenses}
                categories={categories}
                onSelectExpense={setSelectedExpense}
                onOpenNewExpense={() => openNewExpense('foto')}
              />
            }
          />
          <Route
            path="/assistente"
            element={<AssistantView expenses={expenses} />}
          />
          <Route
            path="/orcamentos"
            element={
              <BudgetsView
                budgets={budgets}
                categories={categories}
                onUpdateBudgetLimit={handleUpdateBudgetLimit}
              />
            }
          />
          <Route
            path="/relatorios"
            element={<ReportsView expenses={expenses} categories={categories} />}
          />
          <Route
            path="/configuracoes"
            element={
              <SettingsView
                profile={profile}
                categories={categories}
                expenses={expenses}
                isDark={isDark}
                onSetTheme={(mode) => setIsDark(mode === 'dark')}
                onUpdateDisplayName={handleUpdateDisplayName}
                onAddCategory={handleAddCategory}
                onDeleteCategory={handleDeleteCategory}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SidebarLayout>

      <NewExpenseModal
        isOpen={isNewExpenseOpen}
        initialMode={newExpenseMode}
        categories={categories}
        onClose={() => setIsNewExpenseOpen(false)}
        onSaveExpense={handleSaveNewExpense}
      />

      <ExpenseDetailModal
        expense={selectedExpense}
        categories={categories}
        onClose={() => setSelectedExpense(null)}
        onUpdate={handleUpdateExpense}
        onDelete={handleDeleteExpense}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-500/40 bg-white dark:bg-[#151B23] shadow-xl text-sm"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="font-medium text-slate-900 dark:text-white">{toast}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-slate-700 dark:hover:text-white ml-1"
            aria-label="Fechar notificação"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <TrocadoAppShell />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
