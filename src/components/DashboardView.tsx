import React, { useMemo, useState } from 'react';
import {
  ScanLine,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
  ReceiptText,
  Plus,
} from 'lucide-react';
import { ActiveView, Budget, Category, Expense, Profile } from '../types/finance';
import {
  EXPENSE_SOURCE_LABELS,
  PAYMENT_METHOD_LABELS,
  formatCentsBRL,
  formatDateBR,
  getCurrentMonthSaoPaulo,
} from '../utils/formatters';
import { CategoryIcon, getCategoryColor } from './CategoryIcon';

interface DashboardViewProps {
  profile: Profile | null;
  expenses: Expense[];
  budgets: Budget[];
  categories: Category[];
  isLoading?: boolean;
  onNavigate: (view: ActiveView) => void;
  onOpenNewExpense: (initialMode?: 'foto' | 'texto' | 'manual') => void;
  onSelectExpense: (expense: Expense) => void;
}

export function DashboardView({
  profile,
  expenses,
  budgets,
  categories,
  isLoading = false,
  onNavigate,
  onOpenNewExpense,
  onSelectExpense,
}: DashboardViewProps) {
  const [hoveredDay, setHoveredDay] = useState<{ day: string; amountCents: number } | null>(null);
  const currentMonth = getCurrentMonthSaoPaulo();

  const totalSpentCents = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amountCents, 0),
    [expenses]
  );

  const totalBudgetCents = useMemo(
    () => budgets.reduce((sum, b) => sum + b.monthlyLimitCents, 0),
    [budgets]
  );

  const remainingBudgetCents = Math.max(0, totalBudgetCents - totalSpentCents);

  const categoryTotals = useMemo(() => {
    const categoryLookup = new Map(categories.map((c) => [c.id, c]));
    const map = new Map<string, { name: string; color: string; amountCents: number }>();

    for (const e of expenses) {
      const cat = categoryLookup.get(e.categoryId);
      const name = e.categoryName || cat?.name || 'Outros';
      const color = e.categoryColor || cat?.color || getCategoryColor(name);
      const existing = map.get(e.categoryId);
      if (existing) {
        existing.amountCents += e.amountCents;
      } else {
        map.set(e.categoryId, { name, color, amountCents: e.amountCents });
      }
    }

    return Array.from(map.entries())
      .map(([id, info]) => ({
        id,
        ...info,
        pct: totalSpentCents > 0 ? (info.amountCents / totalSpentCents) * 100 : 0,
      }))
      .sort((a, b) => b.amountCents - a.amountCents);
  }, [expenses, categories, totalSpentCents]);

  const dailySeries = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const e of expenses) {
      byDate.set(e.expenseDate, (byDate.get(e.expenseDate) || 0) + e.amountCents);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amountCents]) => ({
        date,
        day: date.slice(8, 10),
        amountCents,
      }));
  }, [expenses]);

  const maxDailyCents = useMemo(
    () => Math.max(...dailySeries.map((d) => d.amountCents), 1),
    [dailySeries]
  );

  const averageDailyCents = useMemo(() => {
    if (dailySeries.length === 0) return 0;
    return Math.round(totalSpentCents / dailySeries.length);
  }, [dailySeries.length, totalSpentCents]);

  const donutSegments = useMemo(() => {
    const radius = 54;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    return categoryTotals.map((cat) => {
      const length = (cat.pct / 100) * circumference;
      const seg = {
        ...cat,
        strokeDasharray: `${length} ${circumference - length}`,
        strokeDashoffset: -offset,
      };
      offset += length;
      return seg;
    });
  }, [categoryTotals]);

  const greetingName = profile?.displayName ? `, ${profile.displayName.split(' ')[0]}` : '';

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 rounded-lg bg-slate-200 dark:bg-[#1C2025]" />
          <div className="h-9 w-40 rounded-lg bg-slate-200 dark:bg-[#1C2025]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-52 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
          <div className="lg:col-span-5 h-52 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
          <div className="lg:col-span-5 h-72 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
          <div className="lg:col-span-7 h-72 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
        </div>
      </div>
    );
  }

  if (expenses.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Olá{greetingName}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {currentMonth.label} · Comece registrando suas despesas para visualizar análises.
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-10 sm:p-14 flex flex-col items-center text-center max-w-2xl mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-5">
            <ReceiptText className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Registre sua primeira despesa
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-2 leading-relaxed">
            Envie a foto de um comprovante, descreva o gasto em texto livre, grave um áudio ou preencha manualmente para acompanhar seu mês em tempo real.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => onOpenNewExpense('foto')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-sm transition-colors"
            >
              <ScanLine className="w-4 h-4" />
              Escanear Comprovante
            </button>
            <button
              type="button"
              onClick={() => onOpenNewExpense('manual')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] hover:bg-slate-100 dark:hover:bg-[#1C2025] text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Preencher Manualmente
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Olá{greetingName}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Resumo financeiro · {currentMonth.label}
          </p>
        </div>

        <button
          type="button"
          onClick={() => onOpenNewExpense('foto')}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] hover:bg-slate-50 dark:hover:bg-[#1C2025] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors self-start md:self-auto whitespace-nowrap"
        >
          <ScanLine className="w-4 h-4 text-emerald-500" />
          <span>Escanear Recibo</span>
        </button>
      </div>

      {/* Row 1: Hero KPI + Assistant Entry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 flex flex-col justify-between">
          <div>
            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
              Total Gasto no Período
            </span>
            <div className="mt-2 flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white font-mono-tabular">
                {formatCentsBRL(totalSpentCents)}
              </span>
              {totalBudgetCents > 0 && (
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                  Restante do orçamento: {formatCentsBRL(remainingBudgetCents)}
                </span>
              )}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-[#222C38] grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Lançamentos</p>
              <p className="text-base font-semibold text-slate-900 dark:text-white font-mono-tabular mt-0.5">
                {expenses.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Orçamento Alocado</p>
              <p className="text-base font-semibold text-slate-900 dark:text-white font-mono-tabular mt-0.5">
                {totalBudgetCents > 0 ? formatCentsBRL(totalBudgetCents) : '—'}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Média por Dia Ativo</p>
              <p className="text-base font-semibold text-slate-900 dark:text-white font-mono-tabular mt-0.5">
                {formatCentsBRL(averageDailyCents)}
              </p>
            </div>
          </div>
        </section>

        <section
          className="lg:col-span-5 rounded-2xl border border-violet-200 dark:border-violet-500/30 bg-white dark:bg-[#151B23] p-6 flex flex-col justify-between relative overflow-hidden"
          style={{
            backgroundImage:
              'radial-gradient(circle at top right, rgba(139, 92, 246, 0.12), transparent 65%)',
          }}
        >
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
              <Sparkles className="w-3.5 h-3.5" />
              Assistente Financeiro IA
            </span>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-3">
              Converse com suas despesas
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
              Pergunte em linguagem natural quanto gastou em qualquer categoria, encontre seus maiores lançamentos ou peça sugestões de economia.
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onNavigate('assistant')}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              Abrir Assistente IA
            </button>
            <button
              type="button"
              onClick={() => onNavigate('budgets')}
              className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-[#222C38] hover:bg-slate-100 dark:hover:bg-[#1C2025] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
            >
              Ver Orçamentos
            </button>
          </div>
        </section>
      </div>

      {/* Row 2: Gastos por Categoria + Gastos Diários */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Gastos por Categoria
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {categoryTotals.length}{' '}
                {categoryTotals.length === 1 ? 'categoria com registro' : 'categorias com registro'}
              </p>
            </div>
            {categoryTotals[0] && (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                Maior: {categoryTotals[0].name} ({categoryTotals[0].pct.toFixed(1)}%)
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="relative w-36 h-36 shrink-0">
              <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
                <circle
                  cx="70"
                  cy="70"
                  r="54"
                  fill="none"
                  strokeWidth="16"
                  className="stroke-slate-100 dark:stroke-[#1C2025]"
                />
                {donutSegments.map((seg) => (
                  <circle
                    key={seg.id}
                    cx="70"
                    cy="70"
                    r="54"
                    fill="none"
                    stroke={seg.color}
                    strokeWidth="16"
                    strokeDasharray={seg.strokeDasharray}
                    strokeDashoffset={seg.strokeDashoffset}
                    className="transition-all duration-300"
                  />
                ))}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[80px]">
                  {categoryTotals[0]?.name || 'Total'}
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white font-mono-tabular">
                  {categoryTotals[0] ? `${categoryTotals[0].pct.toFixed(1)}%` : '0%'}
                </span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-2.5">
              {categoryTotals.slice(0, 6).map((cat) => (
                <div key={cat.id} className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                      {cat.name}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 font-mono-tabular">
                      {cat.pct.toFixed(1)}%
                    </span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-white font-mono-tabular whitespace-nowrap">
                    {formatCentsBRL(cat.amountCents)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Gastos Diários
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {dailySeries.length}{' '}
                {dailySeries.length === 1 ? 'dia com movimento' : 'dias com movimento'}
              </p>
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 font-mono-tabular">
              {hoveredDay
                ? `Dia ${hoveredDay.day}: ${formatCentsBRL(hoveredDay.amountCents)}`
                : `Média: ${formatCentsBRL(averageDailyCents)}/dia`}
            </span>
          </div>

          <div className="h-44 flex items-end gap-1.5 sm:gap-2.5 pt-4">
            {dailySeries.map((d) => {
              const heightPct = Math.max(8, Math.round((d.amountCents / maxDailyCents) * 100));
              const isPeak = d.amountCents === maxDailyCents;
              return (
                <button
                  key={d.date}
                  type="button"
                  onMouseEnter={() => setHoveredDay({ day: d.day, amountCents: d.amountCents })}
                  onMouseLeave={() => setHoveredDay(null)}
                  onFocus={() => setHoveredDay({ day: d.day, amountCents: d.amountCents })}
                  onBlur={() => setHoveredDay(null)}
                  className="flex-1 flex flex-col items-center gap-2 h-full justify-end group focus-visible:outline-none"
                  aria-label={`${formatDateBR(d.date)}: ${formatCentsBRL(d.amountCents)}`}
                >
                  <div className="w-full flex-1 flex items-end">
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t-md transition-all duration-200 ${
                        isPeak
                          ? 'bg-emerald-500 group-hover:bg-emerald-400'
                          : 'bg-slate-200 dark:bg-[#262A30] group-hover:bg-emerald-500/70'
                      }`}
                    />
                  </div>
                  <span className="text-[10px] font-mono-tabular text-slate-500 dark:text-slate-400">
                    {d.day}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Row 3: Orçamentos + Últimas Despesas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Metas & Orçamentos
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Limites mensais por categoria
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('budgets')}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-[#4EDEA3] hover:underline whitespace-nowrap"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Gerenciar limites
            </button>
          </div>

          {budgets.length === 0 ? (
            <div className="py-6 text-center space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nenhum orçamento mensal definido ainda.
              </p>
              <button
                type="button"
                onClick={() => onNavigate('budgets')}
                className="text-xs font-semibold text-emerald-600 dark:text-[#4EDEA3] hover:underline"
              >
                Definir limites por categoria
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {budgets.slice(0, 5).map((b) => {
                const pct =
                  b.monthlyLimitCents > 0
                    ? Math.round((b.spentCents / b.monthlyLimitCents) * 100)
                    : 0;
                const isDanger = pct > 90;
                return (
                  <div key={b.categoryId} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {b.categoryName}
                      </span>
                      <div className="flex items-center gap-2 font-mono-tabular">
                        <span className="text-slate-900 dark:text-white font-semibold">
                          {formatCentsBRL(b.spentCents)}
                        </span>
                        <span className="text-slate-400 dark:text-slate-500">
                          / {formatCentsBRL(b.monthlyLimitCents)}
                        </span>
                        <span
                          className={`font-semibold ${
                            isDanger
                              ? 'text-red-500'
                              : 'text-emerald-600 dark:text-[#4EDEA3]'
                          }`}
                        >
                          {pct > 100 ? 'Excedido' : `${pct}%`}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-[#1C2025] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          backgroundColor: isDanger ? '#EF4444' : b.categoryColor,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Últimas Despesas
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Lançamentos mais recentes
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('expenses')}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-[#4EDEA3] hover:underline whitespace-nowrap"
            >
              Ver todas ({expenses.length})
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-[#222C38]">
            {expenses.slice(0, 6).map((exp) => {
              const catName = exp.categoryName || 'Outros';
              const catColor = exp.categoryColor || getCategoryColor(catName);
              const isAi = exp.source !== 'manual';
              return (
                <button
                  key={exp.id}
                  type="button"
                  onClick={() => onSelectExpense(exp)}
                  className="w-full py-3.5 flex items-center justify-between gap-3 text-left hover:bg-slate-50 dark:hover:bg-[#181C21] -mx-2 px-2 rounded-xl transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
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
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {exp.merchant}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {catName} · {formatDateBR(exp.expenseDate)} ·{' '}
                        <span className={isAi ? 'text-violet-600 dark:text-violet-300' : ''}>
                          {EXPENSE_SOURCE_LABELS[exp.source]}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white font-mono-tabular">
                      -{formatCentsBRL(exp.amountCents)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {PAYMENT_METHOD_LABELS[exp.paymentMethod]}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
