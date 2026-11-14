import React, { useMemo, useState } from 'react';
import {
  Search,
  Download,
  Plus,
  Sparkles,
  Camera,
  Mic,
  PenLine,
  Receipt,
} from 'lucide-react';
import { Category, Expense, ExpenseSource } from '../types/finance';
import {
  EXPENSE_SOURCE_LABELS,
  PAYMENT_METHOD_LABELS,
  exportExpensesToCSV,
  formatCentsBRL,
  formatDateHeader,
} from '../utils/formatters';
import { CategoryIcon, getCategoryColor } from './CategoryIcon';

interface ExpensesViewProps {
  expenses: Expense[];
  categories: Category[];
  isLoading?: boolean;
  onSelectExpense: (expense: Expense) => void;
  onOpenNewExpense: () => void;
}

const SOURCE_ICONS: Record<ExpenseSource, React.FC<{ className?: string }>> = {
  foto: Camera,
  voz: Mic,
  texto: Sparkles,
  manual: PenLine,
};

export function ExpensesView({
  expenses,
  categories,
  isLoading = false,
  onSelectExpense,
  onOpenNewExpense,
}: ExpensesViewProps) {
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'highest' | 'lowest'>('recent');

  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses
      .filter((e) => {
        if (selectedCategoryId !== 'all' && e.categoryId !== selectedCategoryId) return false;
        if (selectedSource === 'ai' && e.source === 'manual') return false;
        if (selectedSource === 'manual' && e.source !== 'manual') return false;
        if (q) {
          const catName = e.categoryName || categoryMap.get(e.categoryId)?.name || '';
          const hay = `${e.merchant} ${catName} ${e.subcategory || ''} ${e.description || ''} ${
            PAYMENT_METHOD_LABELS[e.paymentMethod]
          }`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'highest') return b.amountCents - a.amountCents;
        if (sortBy === 'lowest') return a.amountCents - b.amountCents;
        const dateCmp = b.expenseDate.localeCompare(a.expenseDate);
        if (dateCmp !== 0) return dateCmp;
        return b.createdAt.localeCompare(a.createdAt);
      });
  }, [expenses, search, selectedCategoryId, selectedSource, sortBy, categoryMap]);

  const totalFilteredCents = useMemo(
    () => filtered.reduce((s, e) => s + e.amountCents, 0),
    [filtered]
  );

  const aiCount = useMemo(
    () => filtered.filter((e) => e.source !== 'manual').length,
    [filtered]
  );

  const groupedByDate = useMemo(() => {
    const groups: Array<{ date: string; subtotalCents: number; items: Expense[] }> = [];
    const map = new Map<string, Expense[]>();
    for (const e of filtered) {
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
  }, [filtered]);

  if (isLoading) {
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
            disabled={filtered.length === 0}
            onClick={() => exportExpensesToCSV(filtered)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] hover:bg-slate-50 dark:hover:bg-[#1C2025] disabled:opacity-50 text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
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
            {formatCentsBRL(totalFilteredCents)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono-tabular">
            {filtered.length} {filtered.length === 1 ? 'transação' : 'transações'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Processadas por IA</p>
          <p className="text-2xl font-bold text-violet-600 dark:text-violet-300 font-mono-tabular mt-1">
            {aiCount} de {filtered.length}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono-tabular">
            {filtered.length ? Math.round((aiCount / filtered.length) * 100) : 0}% automatizado
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Média por Despesa</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono-tabular mt-1">
            {formatCentsBRL(filtered.length ? Math.round(totalFilteredCents / filtered.length) : 0)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Com base no filtro atual
          </p>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-4 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por estabelecimento, categoria ou descrição..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              aria-label="Filtrar por origem"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Todas as origens</option>
              <option value="ai">Registrado por IA</option>
              <option value="manual">Manual</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'recent' | 'highest' | 'lowest')}
              aria-label="Ordenar despesas"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="recent">Mais Recentes</option>
              <option value="highest">Maior Valor</option>
              <option value="lowest">Menor Valor</option>
            </select>
          </div>
        </div>

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
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                selectedCategoryId === cat.id
                  ? 'bg-emerald-500 text-[#0B0F14] font-semibold'
                  : 'bg-slate-100 dark:bg-[#1C2025] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Expense List */}
      {groupedByDate.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-12 text-center space-y-3">
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            {expenses.length === 0
              ? 'Você ainda não possui despesas registradas.'
              : 'Nenhuma despesa encontrada para os filtros aplicados.'}
          </p>
          {expenses.length === 0 ? (
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
              onClick={() => {
                setSearch('');
                setSelectedCategoryId('all');
                setSelectedSource('all');
              }}
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
                  const OriginIcon = SOURCE_ICONS[exp.source] || PenLine;
                  const isAi = exp.source !== 'manual';

                  return (
                    <button
                      key={exp.id}
                      type="button"
                      onClick={() => onSelectExpense(exp)}
                      className="w-full p-4 flex items-center justify-between gap-4 text-left hover:bg-slate-50 dark:hover:bg-[#181C21] transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: `${catColor}18`,
                            color: catColor,
                          }}
                        >
                          <CategoryIcon category={catName} className="w-4 h-4" />
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
                              {EXPENSE_SOURCE_LABELS[exp.source]}
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
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
