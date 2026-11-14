import React, { useMemo, useState } from 'react';
import {
  ScanLine,
  Sparkles,
  ArrowRight,
  SlidersHorizontal,
  ReceiptText,
  Plus,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { ActiveView, DashboardResponse, Expense, InsightResponse, Profile } from '../types/finance';
import {
  EXPENSE_SOURCE_LABELS,
  PAYMENT_METHOD_LABELS,
  formatCentsBRL,
  formatDateBR,
  formatMonthLabel,
  getCurrentMonthISO,
  getSaoPauloGreeting,
  shiftMonthISO,
} from '../utils/formatters';
import { CategoryIcon, getCategoryColor } from './CategoryIcon';

interface DashboardViewProps {
  profile: Profile | null;
  dashboard: DashboardResponse | undefined;
  insight?: InsightResponse;
  isInsightLoading?: boolean;
  selectedMonth: string;
  onChangeMonth: (month: string) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  onNavigate: (view: ActiveView) => void;
  onOpenNewExpense: (initialMode?: 'foto' | 'texto' | 'manual') => void;
  onSelectExpense: (expense: Expense) => void;
}

export function DashboardView({
  profile,
  dashboard,
  insight,
  isInsightLoading = false,
  selectedMonth,
  onChangeMonth,
  isLoading = false,
  isFetching = false,
  isError = false,
  errorMessage,
  onRetry,
  onNavigate,
  onOpenNewExpense,
  onSelectExpense,
}: DashboardViewProps) {
  const [hoveredDay, setHoveredDay] = useState<{ day: string; amountCents: number } | null>(null);
  const currentMonthISO = getCurrentMonthISO();
  const selectedMonthLabel = formatMonthLabel(selectedMonth);

  const greetingPrefix = getSaoPauloGreeting();
  const firstName = profile?.displayName?.trim()
    ? profile.displayName.trim().split(/\s+/)[0]
    : '';
  const greetingText = firstName ? `${greetingPrefix}, ${firstName}` : greetingPrefix;

  const totalSpentCents = dashboard?.totalCents ?? 0;
  const totalBudgetCents = useMemo(
    () => (dashboard?.budgets ?? []).reduce((sum, b) => sum + b.monthlyLimitCents, 0),
    [dashboard?.budgets]
  );
  const remainingBudgetCents = Math.max(0, totalBudgetCents - totalSpentCents);

  const categoryTotals = useMemo(() => {
    const items = dashboard?.byCategory ?? [];
    return items.map((cat) => ({
      id: cat.categoryId,
      name: cat.categoryName,
      color: cat.categoryColor || getCategoryColor(cat.categoryName),
      icon: cat.categoryIcon,
      amountCents: cat.totalCents,
      pct: totalSpentCents > 0 ? (cat.totalCents / totalSpentCents) * 100 : 0,
    }));
  }, [dashboard?.byCategory, totalSpentCents]);

  const dailySeries = useMemo(() => {
    return (dashboard?.byDay ?? []).map((d) => ({
      date: d.expenseDate,
      day: d.expenseDate.slice(8, 10),
      amountCents: d.totalCents,
    }));
  }, [dashboard?.byDay]);

  const maxDailyCents = useMemo(
    () => Math.max(...dailySeries.map((d) => d.amountCents), 1),
    [dailySeries]
  );

  const averageDailyCents = useMemo(() => {
    const activeDays = dashboard?.activeDays ?? 0;
    if (activeDays === 0) return 0;
    return Math.round(totalSpentCents / activeDays);
  }, [dashboard?.activeDays, totalSpentCents]);

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

  const MonthSelector = (
    <div className="inline-flex items-center gap-1 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-1">
      <button
        type="button"
        onClick={() => onChangeMonth(shiftMonthISO(selectedMonth, -1))}
        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1C2025] transition-colors"
        aria-label="Mês anterior"
        title="Mês anterior"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <span className="px-2.5 text-xs font-semibold text-slate-900 dark:text-white whitespace-nowrap min-w-[132px] text-center">
        {selectedMonthLabel}
      </span>
      <button
        type="button"
        onClick={() => onChangeMonth(shiftMonthISO(selectedMonth, 1))}
        disabled={selectedMonth >= currentMonthISO}
        className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1C2025] disabled:opacity-35 disabled:pointer-events-none transition-colors"
        aria-label="Próximo mês"
        title="Próximo mês"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
      {selectedMonth !== currentMonthISO && (
        <button
          type="button"
          onClick={() => onChangeMonth(currentMonthISO)}
          className="px-2 py-1 rounded-lg text-[11px] font-semibold text-emerald-600 dark:text-[#4EDEA3] hover:bg-emerald-500/10 transition-colors"
        >
          Atual
        </button>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between gap-4">
          <div className="h-8 w-64 rounded-lg bg-slate-200 dark:bg-[#1C2025]" />
          <div className="h-9 w-48 rounded-lg bg-slate-200 dark:bg-[#1C2025]" />
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

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {greetingText}
          </h1>
          {MonthSelector}
        </div>
        <div className="rounded-2xl border border-red-500/30 bg-white dark:bg-[#151B23] p-8 text-center max-w-lg mx-auto space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Não foi possível carregar o painel
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {errorMessage || 'Verifique sua conexão e tente novamente.'}
          </p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-xs"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Tentar novamente
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!dashboard || dashboard.expenseCount === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              {greetingText}
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              {selectedMonthLabel} ·{' '}
              {dashboard?.hasAnyExpense
                ? 'Sem despesas registradas neste mês.'
                : 'Comece registrando suas despesas para visualizar análises.'}
            </p>
          </div>

          {MonthSelector}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-10 sm:p-14 flex flex-col items-center text-center max-w-2xl mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-5">
            <ReceiptText className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Registre sua primeira despesa
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-2 leading-relaxed">
            {dashboard?.hasAnyExpense
              ? `Nenhuma despesa foi encontrada em ${selectedMonthLabel}. Adicione um novo lançamento ou navegue para outro mês.`
              : 'Envie a foto de um comprovante, descreva o gasto em texto livre ou preencha manualmente para acompanhar seu mês em tempo real.'}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => onOpenNewExpense('manual')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Registrar Despesa Manual
            </button>
            <button
              type="button"
              onClick={() => onOpenNewExpense('foto')}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] hover:bg-slate-100 dark:hover:bg-[#1C2025] text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors"
            >
              <ScanLine className="w-4 h-4 text-emerald-500" />
              Escanear Comprovante
            </button>
          </div>
        </div>
      </div>
    );
  }

  const variationPct = dashboard.variationPct;
  const variationIsUp = variationPct !== null && variationPct > 0;
  const variationIsDown = variationPct !== null && variationPct < 0;

  return (
    <div className={`space-y-6 transition-opacity ${isFetching ? 'opacity-80' : 'opacity-100'}`}>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            {greetingText}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Resumo financeiro · {selectedMonthLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {MonthSelector}
          <button
            type="button"
            onClick={() => onOpenNewExpense('manual')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] hover:bg-slate-50 dark:hover:bg-[#1C2025] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
          >
            <Plus className="w-4 h-4 text-emerald-500" />
            <span>Registrar Despesa</span>
          </button>
        </div>
      </div>

      {/* Row 1: Hero KPI + Assistant Entry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Total Gasto no Mês
              </span>

              {variationPct !== null ? (
                <span
                  className={`inline-flex items-center gap-1 text-xs font-semibold font-mono-tabular px-2 py-1 rounded-lg ${
                    variationIsUp
                      ? 'bg-red-500/10 text-red-500'
                      : variationIsDown
                        ? 'bg-emerald-500/10 text-emerald-600 dark:text-[#4EDEA3]'
                        : 'bg-slate-100 dark:bg-[#1C2025] text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {variationIsUp && <TrendingUp className="w-3.5 h-3.5" />}
                  {variationIsDown && <TrendingDown className="w-3.5 h-3.5" />}
                  {variationPct > 0 ? '+' : ''}
                  {variationPct.toFixed(1).replace('.', ',')}% vs mês anterior
                </span>
              ) : (
                <span className="text-xs text-slate-400 dark:text-slate-500">
                  Sem registros no mês anterior ({formatMonthLabel(dashboard.previousMonth)})
                </span>
              )}
            </div>

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
            {dashboard.previousTotalCents > 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono-tabular">
                Mês anterior: {formatCentsBRL(dashboard.previousTotalCents)}
              </p>
            )}
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-[#222C38] grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Lançamentos</p>
              <p className="text-base font-semibold text-slate-900 dark:text-white font-mono-tabular mt-0.5">
                {dashboard.expenseCount}
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
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-violet-700 dark:text-violet-300">
                <Sparkles className="w-3.5 h-3.5" />
                {insight?.fromAi ? 'Insight da IA' : 'Assistente Financeiro IA'}
              </span>
              {insight?.cached && (
                <span className="text-[11px] text-slate-400 dark:text-slate-500">
                  {selectedMonthLabel}
                </span>
              )}
            </div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-3">
              {insight?.fromAi ? 'Resumo inteligente do mês' : 'Converse com suas despesas'}
            </h2>
            {isInsightLoading ? (
              <div className="mt-2.5 space-y-2 animate-pulse">
                <div className="h-3.5 w-full rounded bg-violet-500/15" />
                <div className="h-3.5 w-4/5 rounded bg-violet-500/15" />
              </div>
            ) : (
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                {insight?.insight ||
                  'Pergunte em linguagem natural quanto gastou em qualquer categoria, encontre seus maiores lançamentos ou peça sugestões de economia.'}
              </p>
            )}
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

      {/* Row 3: Orçamentos + Últimas 5 Despesas */}
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

          {dashboard.budgets.length === 0 ? (
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
              {dashboard.budgets.slice(0, 5).map((b) => {
                const pct =
                  b.monthlyLimitCents > 0
                    ? Math.round((b.spentCents / b.monthlyLimitCents) * 100)
                    : 0;
                const isOver = pct > 100;
                const isWarning = pct >= 80 && pct <= 100;
                const barColor = isOver ? '#EF4444' : isWarning ? '#F59E0B' : '#10B981';
                const textColorClass = isOver
                  ? 'text-red-500'
                  : isWarning
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-[#4EDEA3]';
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
                        <span className={`font-semibold ${textColorClass}`}>
                          {isOver ? 'Excedido' : `${pct}%`}
                        </span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-[#1C2025] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.min(100, pct)}%`,
                          backgroundColor: barColor,
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
                5 lançamentos mais recentes de {selectedMonthLabel}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('expenses')}
              className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-[#4EDEA3] hover:underline whitespace-nowrap"
            >
              Ver todas ({dashboard.expenseCount})
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-[#222C38]">
            {dashboard.recentExpenses.map((exp) => {
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
                      <CategoryIcon category={catName} icon={exp.categoryIcon} className="w-4 h-4" />
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
