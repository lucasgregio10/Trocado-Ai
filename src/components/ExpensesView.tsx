import React, { useMemo, useState } from 'react';
import {
  Search,
  Download,
  Plus,
  Sparkles,
  Camera,
  Mic,
  PenLine,
  Building2,
  Receipt,
} from 'lucide-react';
import { Expense, ExpenseOrigin } from '../types/finance';
import { formatBRL, formatDateHeader, exportExpensesToCSV } from '../utils/formatters';
import { CategoryIcon, getCategoryColor } from './CategoryIcon';

interface ExpensesViewProps {
  expenses: Expense[];
  categories: string[];
  onSelectExpense: (expense: Expense) => void;
  onOpenNewExpense: () => void;
  initialSearch?: string;
}

const ORIGIN_META: Record<
  ExpenseOrigin,
  { label: string; icon: React.FC<{ className?: string }>; isAi: boolean }
> = {
  ai_scanner: { label: 'IA Scanner', icon: Camera, isAi: true },
  ai_audio: { label: 'Áudio IA', icon: Mic, isAi: true },
  ai_text: { label: 'Texto IA', icon: Sparkles, isAi: true },
  open_finance: { label: 'Open Finance', icon: Building2, isAi: true },
  manual: { label: 'Manual', icon: PenLine, isAi: false },
};

export function ExpensesView({
  expenses,
  categories,
  onSelectExpense,
  onOpenNewExpense,
  initialSearch = '',
}: ExpensesViewProps) {
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [selectedOrigin, setSelectedOrigin] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'recent' | 'highest' | 'lowest'>('recent');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return expenses
      .filter((e) => {
        if (selectedCategory !== 'Todos' && e.category !== selectedCategory) return false;
        if (selectedOrigin === 'ai' && e.origin === 'manual') return false;
        if (selectedOrigin === 'manual' && e.origin !== 'manual') return false;
        if (q) {
          const hay = `${e.merchant} ${e.category} ${e.subcategory} ${e.paymentMethod} ${e.notes || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'highest') return b.amount - a.amount;
        if (sortBy === 'lowest') return a.amount - b.amount;
        return `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`);
      });
  }, [expenses, search, selectedCategory, selectedOrigin, sortBy]);

  const totalFiltered = useMemo(
    () => filtered.reduce((s, e) => s + e.amount, 0),
    [filtered]
  );

  const aiCount = useMemo(
    () => filtered.filter((e) => e.origin !== 'manual').length,
    [filtered]
  );

  const groupedByDate = useMemo(() => {
    const groups: Array<{ date: string; subtotal: number; items: Expense[] }> = [];
    const map = new Map<string, Expense[]>();
    for (const e of filtered) {
      const list = map.get(e.date) || [];
      list.push(e);
      map.set(e.date, list);
    }
    for (const [date, items] of map.entries()) {
      groups.push({
        date,
        subtotal: items.reduce((s, x) => s + x.amount, 0),
        items,
      });
    }
    return groups;
  }, [filtered]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Todas as Despesas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gerencie, audite e filtre lançamentos manuais, cartões integrados e comprovantes via OCR.
          </p>
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => exportExpensesToCSV(filtered)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] hover:bg-slate-50 dark:hover:bg-[#1C2025] text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
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
            {formatBRL(totalFiltered)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono-tabular">
            {filtered.length} transações no período
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
            {formatBRL(filtered.length ? totalFiltered / filtered.length : 0)}
          </p>
          <p className="text-xs text-emerald-600 dark:text-[#4EDEA3] mt-1 font-mono-tabular">
            -4,2% vs. mês anterior
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
              placeholder="Buscar por estabelecimento, categoria, cartão..."
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedOrigin}
              onChange={(e) => setSelectedOrigin(e.target.value)}
              aria-label="Filtrar por origem"
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Todas as origens</option>
              <option value="ai">Registrado por IA / Open Finance</option>
              <option value="manual">Lançamento Manual</option>
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
          {['Todos', ...categories].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === cat
                  ? 'bg-emerald-500 text-[#0B0F14] font-semibold'
                  : 'bg-slate-100 dark:bg-[#1C2025] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped Expense List */}
      {groupedByDate.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-12 text-center">
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            Nenhuma despesa encontrada para os filtros aplicados.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              setSelectedCategory('Todos');
              setSelectedOrigin('all');
            }}
            className="mt-3 text-xs font-semibold text-emerald-600 dark:text-[#4EDEA3] hover:underline"
          >
            Limpar filtros
          </button>
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
                  {formatBRL(group.subtotal)}
                </span>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] divide-y divide-slate-100 dark:divide-[#222C38]">
                {group.items.map((exp) => {
                  const originInfo = ORIGIN_META[exp.origin] || ORIGIN_META.manual;
                  const OriginIcon = originInfo.icon;
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
                            backgroundColor: `${getCategoryColor(exp.category)}18`,
                            color: getCategoryColor(exp.category),
                          }}
                        >
                          <CategoryIcon category={exp.category} className="w-4 h-4" />
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                              {exp.merchant}
                            </span>
                            {exp.receiptImage && (
                              <Receipt
                                className="w-3.5 h-3.5 text-emerald-500 shrink-0"
                                aria-label="Comprovante anexado"
                              />
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex-wrap">
                            <span>{exp.category}</span>
                            <span aria-hidden="true">·</span>
                            <span>{exp.paymentMethod}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">{exp.time}</span>
                            <span aria-hidden="true">·</span>
                            <span
                              className={`inline-flex items-center gap-1 ${
                                originInfo.isAi
                                  ? 'text-violet-600 dark:text-violet-300'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              <OriginIcon className="w-3 h-3" />
                              {originInfo.label}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white font-mono-tabular">
                          -{formatBRL(exp.amount)}
                        </p>
                        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                          {exp.status}
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
