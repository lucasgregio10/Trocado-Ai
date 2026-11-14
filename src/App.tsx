import React, { useEffect, useState } from 'react';
import { CheckCircle2, Undo2, X } from 'lucide-react';
import {
  ActiveView,
  BankConnection,
  CategoryBudget,
  CustomCategory,
  Expense,
  SavingsGoal,
} from './types/finance';
import {
  INITIAL_BUDGETS,
  INITIAL_CONNECTIONS,
  INITIAL_CUSTOM_CATEGORIES,
  INITIAL_EXPENSES,
  INITIAL_GOALS,
} from './data/mockFinanceData';
import { SidebarLayout } from './components/SidebarLayout';
import { DashboardView } from './components/DashboardView';
import { ExpensesView } from './components/ExpensesView';
import { AssistantView } from './components/AssistantView';
import { BudgetsView } from './components/BudgetsView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { NewExpenseModal } from './components/NewExpenseModal';
import { ExpenseDetailModal } from './components/ExpenseDetailModal';

interface ToastState {
  message: string;
  undoExpenseId?: string;
}

export default function App() {
  const [activeView, setActiveView] = useState<ActiveView>('dashboard');
  const [isDark, setIsDark] = useState<boolean>(true);
  const [expenses, setExpenses] = useState<Expense[]>(INITIAL_EXPENSES);
  const [budgets, setBudgets] = useState<CategoryBudget[]>(INITIAL_BUDGETS);
  const [goals, setGoals] = useState<SavingsGoal[]>(INITIAL_GOALS);
  const [connections, setConnections] = useState<BankConnection[]>(INITIAL_CONNECTIONS);
  const [customCategories, setCustomCategories] = useState<CustomCategory[]>(
    INITIAL_CUSTOM_CATEGORIES
  );

  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
  const [newExpenseMode, setNewExpenseMode] = useState<'scanner' | 'text' | 'manual'>('scanner');
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Sync dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  // Keyboard shortcut Cmd/Ctrl+K jumps to Expenses search
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveView('expenses');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const showToast = (message: string, undoExpenseId?: string) => {
    setToast({ message, undoExpenseId });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const categoryNames = customCategories.map((c) => c.name);

  const handleSaveNewExpense = (expense: Expense) => {
    setExpenses((prev) => [expense, ...prev]);
    setIsNewExpenseOpen(false);
    showToast('Despesa salva!', expense.id);
  };

  const handleUndoExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    setToast(null);
  };

  const handleUpdateExpense = (updated: Expense) => {
    setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
    setSelectedExpense(updated);
    showToast('Despesa atualizada!');
  };

  const handleDeleteExpense = (id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
    showToast('Despesa removida.');
  };

  const handleUpdateBudgetLimit = (id: string, newLimit: number) => {
    setBudgets((prev) =>
      prev.map((b) => (b.id === id ? { ...b, limit: newLimit } : b))
    );
  };

  const handleApplyAiRebalance = () => {
    setBudgets((prev) =>
      prev.map((b) => {
        if (b.category === 'Alimentação') return { ...b, limit: 1600 };
        if (b.category === 'Transporte') return { ...b, limit: 600 };
        return b;
      })
    );
    showToast('Reequilíbrio sugerido pela IA aplicado aos orçamentos!');
  };

  const handleContributeGoal = (goalId: string, amount: number) => {
    setGoals((prev) =>
      prev.map((g) =>
        g.id === goalId ? { ...g, current: Math.min(g.target, g.current + amount) } : g
      )
    );
    showToast(`Aporte de R$ ${amount.toFixed(2).replace('.', ',')} registrado!`);
  };

  const handleAddBudgetCategory = (category: string, limit: number) => {
    setBudgets((prev) => [
      ...prev,
      {
        id: `bud-${Date.now()}`,
        category,
        description: 'Categoria personalizada',
        limit,
        color: '#06B6D4',
        iconKey: 'layers',
      },
    ]);
    if (!categoryNames.includes(category)) {
      setCustomCategories((prev) => [
        ...prev,
        { id: `cat-${Date.now()}`, name: category, color: '#06B6D4', iconKey: 'layers' },
      ]);
    }
    showToast(`Orçamento para ${category} criado!`);
  };

  const handleToggleAutoSync = (id: string) => {
    setConnections((prev) =>
      prev.map((c) => (c.id === id ? { ...c, autoSync: !c.autoSync } : c))
    );
  };

  const handleRevalidateBank = (id: string) => {
    setConnections((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status: 'connected',
              lastSyncLabel: 'Sincronizado agora',
              autoSync: true,
              consentUntil: '14 Nov 2025',
            }
          : c
      )
    );
    showToast('Conexão Open Finance revalidada com sucesso!');
  };

  const handleSyncAllBanks = () => {
    setConnections((prev) =>
      prev.map((c) =>
        c.status === 'connected' ? { ...c, lastSyncLabel: 'Agora mesmo' } : c
      )
    );
    showToast('Todas as contas conectadas foram sincronizadas!');
  };

  const handleAddCustomCategory = (name: string, color: string) => {
    setCustomCategories((prev) => [
      ...prev,
      { id: `cat-${Date.now()}`, name, color, iconKey: 'layers' },
    ]);
    showToast(`Categoria "${name}" adicionada!`);
  };

  const handleDeleteCustomCategory = (id: string) => {
    setCustomCategories((prev) => prev.filter((c) => c.id !== id));
    showToast('Categoria removida.');
  };

  const openNewExpense = (mode: 'scanner' | 'text' | 'manual' = 'scanner') => {
    setNewExpenseMode(mode);
    setIsNewExpenseOpen(true);
  };

  return (
    <>
      <SidebarLayout
        activeView={activeView}
        onNavigate={setActiveView}
        onOpenNewExpense={() => openNewExpense('scanner')}
        isDark={isDark}
        onToggleTheme={() => setIsDark((d) => !d)}
        onQuickSearch={() => setActiveView('expenses')}
      >
        {activeView === 'dashboard' && (
          <DashboardView
            expenses={expenses}
            budgets={budgets}
            onNavigate={setActiveView}
            onOpenNewExpense={openNewExpense}
            onSelectExpense={setSelectedExpense}
            onApplyAiRebalance={handleApplyAiRebalance}
          />
        )}

        {activeView === 'expenses' && (
          <ExpensesView
            expenses={expenses}
            categories={categoryNames}
            onSelectExpense={setSelectedExpense}
            onOpenNewExpense={() => openNewExpense('scanner')}
          />
        )}

        {activeView === 'assistant' && (
          <AssistantView expenses={expenses} budgets={budgets} />
        )}

        {activeView === 'budgets' && (
          <BudgetsView
            expenses={expenses}
            budgets={budgets}
            goals={goals}
            onUpdateBudgetLimit={handleUpdateBudgetLimit}
            onApplyAiRebalance={handleApplyAiRebalance}
            onContributeGoal={handleContributeGoal}
            onAddBudgetCategory={handleAddBudgetCategory}
          />
        )}

        {activeView === 'reports' && <ReportsView expenses={expenses} />}

        {activeView === 'settings' && (
          <SettingsView
            connections={connections}
            customCategories={customCategories}
            expenses={expenses}
            isDark={isDark}
            onSetTheme={(mode) => setIsDark(mode === 'dark')}
            onToggleAutoSync={handleToggleAutoSync}
            onRevalidateBank={handleRevalidateBank}
            onSyncAll={handleSyncAllBanks}
            onAddCategory={handleAddCustomCategory}
            onDeleteCategory={handleDeleteCustomCategory}
            onNotify={(msg) => showToast(msg)}
          />
        )}
      </SidebarLayout>

      {/* Modals */}
      <NewExpenseModal
        isOpen={isNewExpenseOpen}
        initialMode={newExpenseMode}
        categories={categoryNames}
        onClose={() => setIsNewExpenseOpen(false)}
        onSaveExpense={handleSaveNewExpense}
      />

      <ExpenseDetailModal
        expense={selectedExpense}
        categories={categoryNames}
        onClose={() => setSelectedExpense(null)}
        onUpdate={handleUpdateExpense}
        onDelete={handleDeleteExpense}
      />

      {/* Toast Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-500/40 bg-white dark:bg-[#151B23] shadow-xl text-sm"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="font-medium text-slate-900 dark:text-white">{toast.message}</span>
          {toast.undoExpenseId && (
            <button
              type="button"
              onClick={() => handleUndoExpense(toast.undoExpenseId!)}
              className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-[#4EDEA3] hover:underline ml-1"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Desfazer
            </button>
          )}
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
