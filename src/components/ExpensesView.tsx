import React, { useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import {
  Search,
  Download,
  Plus,
  Sparkles,
  Camera,
  Mic,
  PenLine,
  Receipt,
  MoreVertical,
  Pencil,
  Trash2,
  Loader2,
  SlidersHorizontal,
  X,
  AlertCircle,
} from 'lucide-react';
import {
  Category,
  Expense,
  ExpenseSource,
  ExpensesPageResponse,
  PaymentMethod,
} from '../types/finance';
import {
  EXPENSE_SOURCE_LABELS,
  PAYMENT_METHOD_LABELS,
  formatCentsBRL,
  formatCentsInputMask,
  formatDateHeader,
  parseDigitsToCents,
} from '../utils/formatters';
import { CategoryIcon, getCategoryColor } from './CategoryIcon';
import { apiFetch, downloadAuthenticatedCsv } from '../lib/api';

interface ExpensesViewProps {
  userId?: string;
  categories: Category[];
  onSelectExpense: (expense: Expense, startInEdit?: boolean) => void;
  onDeleteExpense: (id: string) => Promise<void>;
  onOpenNewExpense: () => void;
  onNotify?: (toast: { type: 'success' | 'error'; message: string }) => void;
}

const SOURCE_ICONS: Record<ExpenseSource, React.FC<{ className?: string }>> = {
  foto: Camera,
  voz: Mic,
  texto: Sparkles,
  manual: PenLine,
};

export function ExpensesView({
  userId,
  categories,
  onSelectExpense,
  onDeleteExpense,
  onOpenNewExpense,
  onNotify,
}: ExpensesViewProps) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [minCents, setMinCents] = useState(0);
  const [maxCents, setMaxCents] = useState(0);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchInput.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [openMenuId]);

  const filters = useMemo(
    () => ({
      q: debouncedQuery,
      category_id: selectedCategoryId === 'all' ? '' : selectedCategoryId,
      payment_method: selectedPaymentMethod === 'all' ? '' : selectedPaymentMethod,
      source: selectedSource === 'all' ? '' : selectedSource,
      from: fromDate,
      to: toDate,
      min: minCents > 0 ? String(minCents) : '',
      max: maxCents > 0 ? String(maxCents) : '',
    }),
    [
      debouncedQuery,
      selectedCategoryId,
      selectedPaymentMethod,
      selectedSource,
      fromDate,
      toDate,
      minCents,
      maxCents,
    ]
  );

  const hasActiveFilters = Boolean(
    filters.q ||
      filters.category_id ||
      filters.payment_method ||
      filters.source ||
      filters.from ||
      filters.to ||
      filters.min ||
      filters.max
  );

  const expensesQuery = useInfiniteQuery({
    queryKey: ['expenses', userId, filters],
    enabled: Boolean(userId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams();
      params.set('limit', '30');
      if (filters.q) params.set('q', filters.q);
      if (filters.category_id) params.set('category_id', filters.category_id);
      if (filters.payment_method) params.set('payment_method', filters.payment_method);
      if (filters.source) params.set('source', filters.source);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      if (filters.min) params.set('min', filters.min);
      if (filters.max) params.set('max', filters.max);
      if (pageParam) params.set('cursor', pageParam);
      return apiFetch<ExpensesPageResponse>(`/api/expenses?${params.toString()}`);
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const expenses = useMemo(
    () => expensesQuery.data?.pages.flatMap((page) => page.items) ?? [],
    [expensesQuery.data]
  );

  const summary = expensesQuery.data?.pages[0]?.summary ?? {
    totalCount: expenses.length,
    totalCents: expenses.reduce((s, e) => s + e.amountCents, 0),
    aiCount: expenses.filter((e) => e.source !== 'manual').length,
  };

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const groupedByDate = useMemo(() => {
    const groups: Array<{ date: string; subtotalCents: number; items: Expense[] }> = [];
    const map = new Map<string, Expense[]>();
    for (const e of expenses) {
      const list = map.get(e.expenseDate) || [];
      list.push(e);
      map.set(e.expenseDate, list);
    }
    for (const [date, items] of map.entries()) {
      groups.push({
        date,
        subtotalCents: items.reduce((s, x) => s + x.amountCents, 0),
        items,
      });
    }
    return groups;
  }, [expenses]);

  const clearFilters = () => {
    setSearchInput('');
    setDebouncedQuery('');
    setSelectedCategoryId('all');
    setSelectedPaymentMethod('all');
    setSelectedSource('all');
    setFromDate('');
    setToDate('');
    setMinCents(0);
    setMaxCents(0);
  };

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteExpense(id);
      setConfirmDeleteId(null);
      setOpenMenuId(null);
    } finally {
      setDeletingId(null);
    }
  };

  if (expensesQuery.isLoading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 w-56 rounded-lg bg-slate-200 dark:bg-[#1C2025]" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-24 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
          <div className="h-24 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
          <div className="h-24 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
        </div>
        <div className="h-64 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Todas as Despesas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gerencie, filtre e audite seus lançamentos registrados.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            disabled={isExporting || expenses.length === 0}
            onClick={async () => {
              if (isExporting) return;
              setIsExporting(true);
              try {
                await downloadAuthenticatedCsv(fromDate || undefined, toDate || undefined);
                onNotify?.({ type: 'success', message: 'Arquivo CSV baixado!' });
              } catch (err) {
                onNotify?.({
                  type: 'error',
                  message: err instanceof Error ? err.message : 'Não foi possível exportar o CSV.',
                });
              } finally {
                setIsExporting(false);
              }
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] hover:bg-slate-50 dark:hover:bg-[#1C2025] disabled:opacity-50 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting ? 'Exportando...' : 'Exportar CSV'}
          </button>
          <button
            type="button"
            onClick={onOpenNewExpense}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-sm transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Nova Despesa
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Total Filtrado</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono-tabular mt-1">
            {formatCentsBRL(summary.totalCents)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono-tabular">
            {summary.totalCount} {summary.totalCount === 1 ? 'transação' : 'transações'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Processadas por IA</p>
          <p className="text-2xl font-bold text-violet-600 dark:text-violet-300 font-mono-tabular mt-1">
            {summary.aiCount} de {summary.totalCount}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono-tabular">
            {summary.totalCount ? Math.round((summary.aiCount / summary.totalCount) * 100) : 0}% automatizado
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Média por Despesa</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono-tabular mt-1">
            {formatCentsBRL(
              summary.totalCount ? Math.round(summary.totalCents / summary.totalCount) : 0
            )}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Com base no filtro atual
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por estabelecimento, categoria ou observação..."
              className="w-full pl-10 pr-8 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            {searchInput && (
              <button
                type="button"
                onClick={() => setSearchInput('')}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={selectedPaymentMethod}
              onChange={(e) => setSelectedPaymentMethod(e.target.value)}
              aria-label="Filtrar por forma de pagamento"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Todos os pagamentos</option>
              {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                <option key={method} value={method}>
                  {PAYMENT_METHOD_LABELS[method]}
                </option>
              ))}
            </select>

            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              aria-label="Filtrar por origem"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Todas as origens</option>
              <option value="ai">Registrado por IA</option>
              <option value="manual">Manual</option>
              <option value="foto">Foto (IA)</option>
              <option value="texto">Texto (IA)</option>
              <option value="voz">Voz (IA)</option>
            </select>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters((s) => !s)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors ${
                showAdvancedFilters || fromDate || toDate || minCents > 0 || maxCents > 0
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-[#4EDEA3]'
                  : 'border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-slate-700 dark:text-slate-300'
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
              <span>Filtros</span>
            </button>
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-[#222C38]">
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Data inicial
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm font-mono-tabular text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Data final
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm font-mono-tabular text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Valor mínimo
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatCentsInputMask(minCents)}
                onChange={(e) => setMinCents(parseDigitsToCents(e.target.value))}
                placeholder="R$ 0,00"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm font-mono-tabular text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">
                Valor máximo
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={formatCentsInputMask(maxCents)}
                onChange={(e) => setMaxCents(parseDigitsToCents(e.target.value))}
                placeholder="Sem limite"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm font-mono-tabular text-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          <button
            type="button"
            onClick={() => setSelectedCategoryId('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              selectedCategoryId === 'all'
                ? 'bg-emerald-500 text-[#0B0F14] font-semibold'
                : 'bg-slate-100 dark:bg-[#1C2025] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            Todas
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategoryId(cat.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                selectedCategoryId === cat.id
                  ? 'bg-emerald-500 text-[#0B0F14] font-semibold'
                  : 'bg-slate-100 dark:bg-[#1C2025] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span
                className="w-2 h-2 rounded-xs shrink-0"
                style={{
                  backgroundColor: selectedCategoryId === cat.id ? '#0B0F14' : cat.color,
                }}
              />
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {expensesQuery.isError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 flex items-center justify-between gap-3 text-xs text-red-600 dark:text-red-300">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>
              {expensesQuery.error instanceof Error
                ? expensesQuery.error.message
                : 'Erro ao carregar despesas.'}
            </span>
          </div>
          <button
            type="button"
            onClick={() => expensesQuery.refetch()}
            className="font-semibold underline shrink-0"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Grouped Expense List */}
      {groupedByDate.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-12 text-center space-y-3">
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {hasActiveFilters
              ? 'Nenhuma despesa encontrada para os filtros aplicados.'
              : 'Você ainda não possui despesas registradas.'}
          </p>
          {!hasActiveFilters ? (
            <button
              type="button"
              onClick={onOpenNewExpense}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-xs"
            >
              <Plus className="w-4 h-4" />
              Registrar Primeira Despesa
            </button>
          ) : (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs font-semibold text-emerald-600 dark:text-[#4EDEA3] hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByDate.map((group) => (
            <section key={group.date} className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {formatDateHeader(group.date)}
                </h2>
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300 font-mono-tabular">
                  {group.items.length} {group.items.length === 1 ? 'despesa' : 'despesas'} · Subtotal:{' '}
                  {formatCentsBRL(group.subtotalCents)}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] divide-y divide-slate-100 dark:divide-[#222C38]">
                {group.items.map((exp) => {
                  const cat = categoryMap.get(exp.categoryId);
                  const catName = exp.categoryName || cat?.name || 'Outros';
                  const catColor = exp.categoryColor || cat?.color || getCategoryColor(catName);
                  const catIcon = exp.categoryIcon || cat?.icon;
                  const OriginIcon = SOURCE_ICONS[exp.source] || PenLine;
                  const isAi = exp.source !== 'manual';
                  const isConfirmingDelete = confirmDeleteId === exp.id;
                  const isDeleting = deletingId === exp.id;

                  return (
                    <div
                      key={exp.id}
                      className="relative p-4 flex items-center justify-between gap-3 hover:bg-slate-50 dark:hover:bg-[#181C21] transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                    >
                      <button
                        type="button"
                        onClick={() => onSelectExpense(exp, false)}
                        className="flex-1 flex items-center justify-between gap-4 min-w-0 text-left"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: `${catColor}18`,
                              color: catColor,
                            }}
                          >
                            <CategoryIcon category={catName} icon={catIcon} className="w-4 h-4" />
                          </div>

                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                {exp.merchant}
                              </span>
                              {exp.receiptKey && (
                                <Receipt
                                  className="w-3.5 h-3.5 text-emerald-500 shrink-0"
                                  aria-label="Comprovante anexado"
                                />
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                              <span>{catName}</span>
                              <span aria-hidden="true">·</span>
                              <span>{PAYMENT_METHOD_LABELS[exp.paymentMethod]}</span>
                              <span aria-hidden="true">·</span>
                              <span
                                className={`inline-flex items-center gap-1 ${
                                  isAi
                                    ? 'text-violet-600 dark:text-violet-300'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                <OriginIcon className="w-3 h-3" />
                                {isAi ? 'Registrado por IA' : EXPENSE_SOURCE_LABELS[exp.source]}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-slate-900 dark:text-white font-mono-tabular">
                            -{formatCentsBRL(exp.amountCents)}
                          </p>
                        </div>
                      </button>

                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleConfirmDelete(exp.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold"
                          >
                            {isDeleting ? 'Excluindo...' : 'Confirmar'}
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => setConfirmDeleteId(null)}
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#222C38] text-xs font-medium text-slate-600 dark:text-slate-300"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div className="relative shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenMenuId((prev) => (prev === exp.id ? null : exp.id));
                            }}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C2025] transition-colors"
                            aria-label={`Ações para ${exp.merchant}`}
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {openMenuId === exp.id && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 top-10 z-20 w-36 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] shadow-xl py-1"
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  onSelectExpense(exp, true);
                                }}
                                className="w-full px-3 py-2 text-left text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1C2025] flex items-center gap-2"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  setConfirmDeleteId(exp.id);
                                }}
                                className="w-full px-3 py-2 text-left text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Excluir
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {expensesQuery.hasNextPage && (
            <div className="flex justify-center pt-2">
              <button
                type="button"
                disabled={expensesQuery.isFetchingNextPage}
                onClick={() => expensesQuery.fetchNextPage()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] hover:bg-slate-50 dark:hover:bg-[#1C2025] disabled:opacity-60 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors"
              >
                {expensesQuery.isFetchingNextPage && (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                )}
                <span>
                  {expensesQuery.isFetchingNextPage
                    ? 'Carregando...'
                    : 'Carregar mais despesas'}
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
