import React, { useCallback, useEffect, useState } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';
import {
  ActiveView,
  BudgetsResponse,
  Category,
  DashboardResponse,
  Expense,
  ExpenseDraftInput,
  InsightResponse,
  MeResponse,
  Profile,
  ThemePreference,
  UpdateMePayload,
} from './types/finance';
import { SidebarLayout } from './components/SidebarLayout';
import { DashboardView } from './components/DashboardView';
import { ExpensesView } from './components/ExpensesView';
import { AssistantView } from './components/AssistantView';
import { BudgetsView } from './components/BudgetsView';
import { ReportsView } from './components/ReportsView';
import { SettingsView } from './components/SettingsView';
import { NewExpenseModal } from './components/NewExpenseModal';
import { ExpenseDetailModal } from './components/ExpenseDetailModal';
import { LoginView } from './components/auth/LoginView';
import { RegisterView } from './components/auth/RegisterView';
import { ForgotPasswordView } from './components/auth/ForgotPasswordView';
import { ResetPasswordView } from './components/auth/ResetPasswordView';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { apiFetch, setUnauthorizedHandler } from './lib/api';
import { getCurrentMonthISO } from './utils/formatters';
import { OfflineIndicator } from './components/OfflineIndicator';

const THEME_STORAGE_KEY = 'trocado-theme';

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

function getInitialTheme(): ThemePreference {
  if (typeof window === 'undefined') return 'dark';
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'light' || saved === 'dark' || saved === 'system') {
    return saved;
  }
  return 'dark';
}

interface ToastState {
  type: 'success' | 'error';
  message: string;
}

function ProtectedShell({
  themePreference,
  isDark,
  onChangeTheme,
  onSyncProfileTheme,
  onNotify,
}: {
  themePreference: ThemePreference;
  isDark: boolean;
  onChangeTheme: (mode: ThemePreference) => void;
  onSyncProfileTheme: (mode: ThemePreference) => void;
  onNotify: (toast: ToastState) => void;
}) {
  const { session, user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const activeView = pathToView(location.pathname);

  const [selectedMonth, setSelectedMonth] = useState<string>(() => getCurrentMonthISO());
  const currentMonthISO = getCurrentMonthISO();
  const [savingBudgetCategoryId, setSavingBudgetCategoryId] = useState<string | null>(null);
  const [isNewExpenseOpen, setIsNewExpenseOpen] = useState(false);
  const [newExpenseMode, setNewExpenseMode] = useState<'foto' | 'texto' | 'manual' | 'choose'>('choose');
  const [sharedImageFile, setSharedImageFile] = useState<File | null>(null);
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [editSelectedExpense, setEditSelectedExpense] = useState(false);

  const meQuery = useQuery({
    queryKey: ['me', user?.id],
    queryFn: () => apiFetch<MeResponse>('/api/me'),
    enabled: Boolean(session && user?.id),
  });

  const receiptsEnabled = Boolean(meQuery.data?.receiptsEnabled);

  const categoriesQuery = useQuery({
    queryKey: ['categories', user?.id],
    queryFn: () => apiFetch<{ categories: Category[] }>('/api/categories'),
    enabled: Boolean(session && user?.id && meQuery.isSuccess),
  });

  const dashboardQuery = useQuery({
    queryKey: ['dashboard', user?.id, selectedMonth],
    queryFn: () => apiFetch<DashboardResponse>(`/api/dashboard?month=${selectedMonth}`),
    enabled: Boolean(session && user?.id),
  });

  const insightQuery = useQuery({
    queryKey: ['insight', user?.id, selectedMonth],
    queryFn: () => apiFetch<InsightResponse>(`/api/insights?month=${selectedMonth}`),
    enabled: Boolean(session && user?.id && (dashboardQuery.data?.expenseCount ?? 0) > 0),
    staleTime: 1000 * 60 * 10,
  });

  const budgetsQuery = useQuery({
    queryKey: ['budgets', user?.id, currentMonthISO],
    queryFn: () => apiFetch<BudgetsResponse>(`/api/budgets?month=${currentMonthISO}`),
    enabled: Boolean(session && user?.id),
  });

  useEffect(() => {
    if (meQuery.data?.profile?.theme) {
      onSyncProfileTheme(meQuery.data.profile.theme);
    }
  }, [meQuery.data?.profile?.theme, onSyncProfileTheme]);

  useEffect(() => {
    if (meQuery.isError && meQuery.error instanceof Error) {
      onNotify({ type: 'error', message: meQuery.error.message });
    }
  }, [meQuery.isError, meQuery.error, onNotify]);

  const invalidateExpenseQueries = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['dashboard'] }),
      qc.invalidateQueries({ queryKey: ['expenses'] }),
      qc.invalidateQueries({ queryKey: ['budgets'] }),
      qc.invalidateQueries({ queryKey: ['categories'] }),
      qc.invalidateQueries({ queryKey: ['reports'] }),
      qc.invalidateQueries({ queryKey: ['insight'] }),
    ]);
  }, [qc]);

  const updateMeMutation = useMutation({
    mutationFn: (payload: UpdateMePayload) =>
      apiFetch<{ profile: Profile }>('/api/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: (data, variables) => {
      qc.setQueryData<MeResponse | undefined>(['me', user?.id], (old) =>
        old
          ? { ...old, profile: data.profile }
          : { profile: data.profile, categories: [] }
      );
      if (variables.displayName !== undefined) {
        onNotify({ type: 'success', message: 'Perfil atualizado!' });
      } else if (variables.theme !== undefined) {
        onNotify({ type: 'success', message: 'Preferência de tema salva!' });
      }
    },
    onError: (err) => {
      onNotify({
        type: 'error',
        message: err instanceof Error ? err.message : 'Não foi possível salvar suas alterações.',
      });
    },
  });

  const createExpenseMutation = useMutation({
    mutationFn: async ({
      draft,
      receiptBlob,
    }: {
      draft: ExpenseDraftInput;
      receiptBlob?: Blob | null;
    }) => {
      const created = await apiFetch<{ expense: Expense }>('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(draft),
      });

      let receiptUploadFailed = false;
      if (draft.source === 'foto' && receiptsEnabled && receiptBlob) {
        try {
          await apiFetch<{ receiptKey: string }>(`/api/expenses/${created.expense.id}/receipt`, {
            method: 'PUT',
            headers: {
              'Content-Type': receiptBlob.type || 'image/jpeg',
            },
            body: receiptBlob,
          });
        } catch {
          receiptUploadFailed = true;
        }
      }

      return { ...created, receiptUploadFailed };
    },
    onSuccess: async (data) => {
      await invalidateExpenseQueries();
      setIsNewExpenseOpen(false);
      setSharedImageFile(null);
      if (data.receiptUploadFailed) {
        onNotify({
          type: 'error',
          message: 'Despesa salva, mas não foi possível enviar a imagem do comprovante.',
        });
      } else {
        onNotify({ type: 'success', message: 'Despesa registrada!' });
      }
    },
    onError: (err) => {
      onNotify({
        type: 'error',
        message: err instanceof Error ? err.message : 'Não foi possível salvar a despesa.',
      });
    },
  });

  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: Partial<ExpenseDraftInput> }) =>
      apiFetch<{ expense: Expense }>(`/api/expenses/${id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    onSuccess: async (data) => {
      setSelectedExpense(data.expense);
      setEditSelectedExpense(false);
      await invalidateExpenseQueries();
      onNotify({ type: 'success', message: 'Despesa atualizada!' });
    },
    onError: (err) => {
      onNotify({
        type: 'error',
        message: err instanceof Error ? err.message : 'Não foi possível atualizar a despesa.',
      });
    },
  });

  const deleteExpenseMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ ok: boolean; id: string }>(`/api/expenses/${id}`, {
        method: 'DELETE',
      }),
    onSuccess: async (_data, deletedId) => {
      if (selectedExpense?.id === deletedId) {
        setSelectedExpense(null);
      }
      await invalidateExpenseQueries();
      onNotify({ type: 'success', message: 'Despesa excluída.' });
    },
    onError: (err) => {
      onNotify({
        type: 'error',
        message: err instanceof Error ? err.message : 'Não foi possível excluir a despesa.',
      });
    },
  });

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
    if (!session || typeof window === 'undefined' || !('caches' in window)) return;

    let cancelled = false;
    const isSharedRedirect = location.search.includes('shared=1');

    (async () => {
      try {
        const cache = await window.caches.open('trocado-share-target-v1');
        const response = await cache.match('/__shared_receipt__');
        if (!response) {
          if (isSharedRedirect && !cancelled) {
            navigate(location.pathname, { replace: true });
          }
          return;
        }

        const blob = await response.blob();
        await cache.delete('/__shared_receipt__');

        if (cancelled) return;

        if (blob.size > 0) {
          const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
          const file = new File([blob], `comprovante-compartilhado.${ext}`, {
            type: blob.type || 'image/jpeg',
          });
          setSharedImageFile(file);
          setNewExpenseMode('foto');
          setIsNewExpenseOpen(true);
        }

        if (isSharedRedirect) {
          navigate(location.pathname, { replace: true });
        }
      } catch {
        if (isSharedRedirect && !cancelled) {
          navigate(location.pathname, { replace: true });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session, location.search, location.pathname, navigate]);

  const categories = categoriesQuery.data?.categories ?? meQuery.data?.categories ?? [];
  const profile: Profile | null =
    meQuery.data?.profile ??
    (user
      ? {
          userId: user.id,
          email: user.email || '',
          displayName:
            (typeof user.user_metadata?.display_name === 'string' &&
              user.user_metadata.display_name) ||
            user.email?.split('@')[0] ||
            '',
          theme: themePreference,
          createdAt: user.created_at || new Date().toISOString(),
        }
      : null);

  const handleNavigate = (view: ActiveView) => {
    navigate(VIEW_PATHS[view]);
  };

  const handleSetTheme = (mode: ThemePreference) => {
    onChangeTheme(mode);
    updateMeMutation.mutate({ theme: mode });
  };

  const handleToggleTheme = () => {
    const next: ThemePreference = isDark ? 'light' : 'dark';
    handleSetTheme(next);
  };

  const handleUpdateDisplayName = (displayName: string) => {
    updateMeMutation.mutate({ displayName });
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      qc.clear();
      navigate('/login', { replace: true });
    } catch (err) {
      onNotify({
        type: 'error',
        message: err instanceof Error ? err.message : 'Não foi possível sair da conta.',
      });
    }
  };

  const openNewExpense = (mode: 'foto' | 'texto' | 'manual' | 'choose' = 'choose') => {
    setSharedImageFile(null);
    setNewExpenseMode(mode);
    setIsNewExpenseOpen(true);
  };

  const handleOpenDetail = (expense: Expense, startInEdit = false) => {
    setSelectedExpense(expense);
    setEditSelectedExpense(startInEdit);
  };

  const saveBudgetMutation = useMutation({
    mutationFn: ({ categoryId, limitCents }: { categoryId: string; limitCents: number }) =>
      apiFetch(`/api/budgets/${categoryId}`, {
        method: 'PUT',
        body: JSON.stringify({ monthly_limit_cents: limitCents }),
      }),
    onMutate: ({ categoryId }) => {
      setSavingBudgetCategoryId(categoryId);
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['budgets'] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      onNotify({ type: 'success', message: 'Limite de orçamento salvo!' });
    },
    onError: (err) => {
      onNotify({
        type: 'error',
        message: err instanceof Error ? err.message : 'Não foi possível salvar o orçamento.',
      });
    },
    onSettled: () => {
      setSavingBudgetCategoryId(null);
    },
  });

  const deleteBudgetMutation = useMutation({
    mutationFn: (categoryId: string) =>
      apiFetch(`/api/budgets/${categoryId}`, {
        method: 'DELETE',
      }),
    onMutate: (categoryId) => {
      setSavingBudgetCategoryId(categoryId);
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['budgets'] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
      ]);
      onNotify({ type: 'success', message: 'Limite de orçamento removido.' });
    },
    onError: (err) => {
      onNotify({
        type: 'error',
        message: err instanceof Error ? err.message : 'Não foi possível remover o orçamento.',
      });
    },
    onSettled: () => {
      setSavingBudgetCategoryId(null);
    },
  });

  const createCategoryMutation = useMutation({
    mutationFn: (payload: { name: string; color: string }) =>
      apiFetch<{ category: Category }>('/api/categories', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    onSuccess: async (data) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['categories'] }),
        qc.invalidateQueries({ queryKey: ['me'] }),
      ]);
      onNotify({ type: 'success', message: `Categoria "${data.category.name}" criada!` });
    },
    onError: (err) => {
      onNotify({
        type: 'error',
        message: err instanceof Error ? err.message : 'Não foi possível criar a categoria.',
      });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: ({ id, name, color }: { id: string; name: string; color: string }) =>
      apiFetch<{ category: Category }>(`/api/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name, color }),
      }),
    onSuccess: async (data) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['categories'] }),
        qc.invalidateQueries({ queryKey: ['me'] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
        qc.invalidateQueries({ queryKey: ['expenses'] }),
        qc.invalidateQueries({ queryKey: ['budgets'] }),
        qc.invalidateQueries({ queryKey: ['reports'] }),
      ]);
      onNotify({ type: 'success', message: `Categoria "${data.category.name}" atualizada!` });
    },
    onError: (err) => {
      onNotify({
        type: 'error',
        message: err instanceof Error ? err.message : 'Não foi possível atualizar a categoria.',
      });
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: ({ id, moveToCategoryId }: { id: string; moveToCategoryId?: string }) => {
      const qs = moveToCategoryId ? `?moveTo=${encodeURIComponent(moveToCategoryId)}` : '';
      return apiFetch<{ ok: boolean; movedExpensesCount: number }>(
        `/api/categories/${id}${qs}`,
        { method: 'DELETE' }
      );
    },
    onSuccess: async (data) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['categories'] }),
        qc.invalidateQueries({ queryKey: ['me'] }),
        qc.invalidateQueries({ queryKey: ['dashboard'] }),
        qc.invalidateQueries({ queryKey: ['expenses'] }),
        qc.invalidateQueries({ queryKey: ['budgets'] }),
        qc.invalidateQueries({ queryKey: ['reports'] }),
      ]);
      onNotify({
        type: 'success',
        message:
          data.movedExpensesCount > 0
            ? `Categoria removida e ${data.movedExpensesCount} despesas movidas.`
            : 'Categoria removida.',
      });
    },
    onError: (err) => {
      onNotify({
        type: 'error',
        message: err instanceof Error ? err.message : 'Não foi possível remover a categoria.',
      });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: (confirmation: string) =>
      apiFetch<{ ok: boolean; authDeleted: boolean }>('/api/account', {
        method: 'DELETE',
        body: JSON.stringify({ confirmation }),
      }),
    onSuccess: async () => {
      qc.clear();
      await signOut();
      onNotify({
        type: 'success',
        message: 'Sua conta e todos os dados foram excluídos definitivamente.',
      });
      navigate('/login', { replace: true });
    },
    onError: (err) => {
      onNotify({
        type: 'error',
        message: err instanceof Error ? err.message : 'Não foi possível excluir a conta.',
      });
    },
  });

  const budgetsList = budgetsQuery.data?.budgets ?? dashboardQuery.data?.budgets ?? [];

  return (
    <>
      <SidebarLayout
        activeView={activeView}
        profile={profile}
        onNavigate={handleNavigate}
        onOpenNewExpense={() => openNewExpense('choose')}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        onQuickSearch={() => handleNavigate('expenses')}
        onSignOut={handleSignOut}
      >
        <Routes>
          <Route
            path="/"
            element={
              <DashboardView
                profile={profile}
                dashboard={dashboardQuery.data}
                insight={insightQuery.data}
                isInsightLoading={insightQuery.isLoading}
                selectedMonth={selectedMonth}
                onChangeMonth={setSelectedMonth}
                isLoading={meQuery.isLoading || dashboardQuery.isLoading}
                isFetching={dashboardQuery.isFetching}
                isError={dashboardQuery.isError}
                errorMessage={
                  dashboardQuery.error instanceof Error ? dashboardQuery.error.message : undefined
                }
                onRetry={() => dashboardQuery.refetch()}
                onNavigate={handleNavigate}
                onOpenNewExpense={openNewExpense}
                onSelectExpense={(exp) => handleOpenDetail(exp, false)}
              />
            }
          />
          <Route
            path="/despesas"
            element={
              <ExpensesView
                userId={user?.id}
                categories={categories}
                onSelectExpense={handleOpenDetail}
                onDeleteExpense={async (id) => {
                  await deleteExpenseMutation.mutateAsync(id);
                }}
                onOpenNewExpense={() => openNewExpense('manual')}
                onNotify={onNotify}
              />
            }
          />
          <Route path="/assistente" element={<AssistantView />} />
          <Route
            path="/orcamentos"
            element={
              <BudgetsView
                budgets={budgetsList}
                categories={categories}
                isLoading={budgetsQuery.isLoading || categoriesQuery.isLoading}
                isSavingCategoryId={savingBudgetCategoryId}
                onSaveBudgetLimit={async (categoryId, limitCents) => {
                  await saveBudgetMutation.mutateAsync({ categoryId, limitCents });
                }}
                onDeleteBudgetLimit={async (categoryId) => {
                  await deleteBudgetMutation.mutateAsync(categoryId);
                }}
              />
            }
          />
          <Route
            path="/relatorios"
            element={<ReportsView userId={user?.id} onNotify={onNotify} />}
          />
          <Route
            path="/configuracoes"
            element={
              <SettingsView
                profile={profile}
                categories={categories}
                themePreference={themePreference}
                isSavingProfile={updateMeMutation.isPending}
                isSavingCategory={
                  createCategoryMutation.isPending ||
                  updateCategoryMutation.isPending ||
                  deleteCategoryMutation.isPending
                }
                isDeletingAccount={deleteAccountMutation.isPending}
                onSetTheme={handleSetTheme}
                onUpdateDisplayName={handleUpdateDisplayName}
                onAddCategory={async (name, color) => {
                  await createCategoryMutation.mutateAsync({ name, color });
                }}
                onUpdateCategory={async (id, payload) => {
                  await updateCategoryMutation.mutateAsync({ id, ...payload });
                }}
                onDeleteCategory={async (id, moveToCategoryId) => {
                  await deleteCategoryMutation.mutateAsync({ id, moveToCategoryId });
                }}
                onDeleteAccount={async (confirmation) => {
                  await deleteAccountMutation.mutateAsync(confirmation);
                }}
                onSignOut={handleSignOut}
                onNotify={onNotify}
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </SidebarLayout>

      <NewExpenseModal
        isOpen={isNewExpenseOpen}
        initialMode={newExpenseMode}
        sharedImageFile={sharedImageFile}
        categories={categories}
        isSaving={createExpenseMutation.isPending}
        onClose={() => {
          setIsNewExpenseOpen(false);
          setSharedImageFile(null);
        }}
        onSaveExpense={async (draft, receiptBlob) => {
          await createExpenseMutation.mutateAsync({ draft, receiptBlob });
        }}
      />

      <ExpenseDetailModal
        expense={selectedExpense}
        initialEditMode={editSelectedExpense}
        receiptsEnabled={receiptsEnabled}
        categories={categories}
        isSaving={updateExpenseMutation.isPending}
        isDeleting={deleteExpenseMutation.isPending}
        onClose={() => {
          setSelectedExpense(null);
          setEditSelectedExpense(false);
        }}
        onUpdate={async (id, payload) => {
          await updateExpenseMutation.mutateAsync({ id, payload });
        }}
        onDelete={async (id) => {
          await deleteExpenseMutation.mutateAsync(id);
        }}
      />
    </>
  );
}

function TrocadoRouter() {
  const { session, loading, isPasswordRecovery } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [themePreference, setThemePreference] = useState<ThemePreference>(getInitialTheme);
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemPrefersDark(e.matches);
    };
    setSystemPrefersDark(mq.matches);
    mq.addEventListener('change', handleChange);
    return () => mq.removeEventListener('change', handleChange);
  }, []);

  const isDark =
    themePreference === 'dark' || (themePreference === 'system' && systemPrefersDark);

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark]);

  const handleSetThemeLocal = useCallback((mode: ThemePreference) => {
    setThemePreference(mode);
    window.localStorage.setItem(THEME_STORAGE_KEY, mode);
  }, []);

  const handleToggleAuthTheme = useCallback(() => {
    handleSetThemeLocal(isDark ? 'light' : 'dark');
  }, [isDark, handleSetThemeLocal]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      qc.clear();
      setToast({ type: 'error', message: 'Sessão expirada. Entre novamente.' });
      navigate('/login', { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate, qc]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[#F8FAFC] dark:bg-[#0B0F14] text-slate-600 dark:text-slate-300">
        <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
        <p className="text-sm font-medium">Carregando Trocado...</p>
      </div>
    );
  }

  const isAuthenticated = Boolean(session);

  return (
    <>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated && !isPasswordRecovery ? (
              <Navigate to="/" replace />
            ) : (
              <LoginView isDark={isDark} onToggleTheme={handleToggleAuthTheme} />
            )
          }
        />
        <Route
          path="/cadastro"
          element={
            isAuthenticated && !isPasswordRecovery ? (
              <Navigate to="/" replace />
            ) : (
              <RegisterView isDark={isDark} onToggleTheme={handleToggleAuthTheme} />
            )
          }
        />
        <Route
          path="/esqueci-senha"
          element={
            isAuthenticated && !isPasswordRecovery ? (
              <Navigate to="/" replace />
            ) : (
              <ForgotPasswordView isDark={isDark} onToggleTheme={handleToggleAuthTheme} />
            )
          }
        />
        <Route
          path="/redefinir-senha"
          element={<ResetPasswordView isDark={isDark} onToggleTheme={handleToggleAuthTheme} />}
        />

        <Route
          path="/*"
          element={
            isAuthenticated ? (
              <ProtectedShell
                themePreference={themePreference}
                isDark={isDark}
                onChangeTheme={handleSetThemeLocal}
                onSyncProfileTheme={handleSetThemeLocal}
                onNotify={setToast}
              />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>

      <OfflineIndicator />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-20 lg:bottom-6 right-4 sm:right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border bg-white dark:bg-[#151B23] shadow-xl text-sm ${
            toast.type === 'error'
              ? 'border-red-500/40'
              : 'border-emerald-500/40'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
          )}
          <span className="font-medium text-slate-900 dark:text-white">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-white ml-1"
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
      <AuthProvider>
        <BrowserRouter>
          <TrocadoRouter />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
