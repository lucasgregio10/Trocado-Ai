import React, { useMemo, useState } from 'react';
import {
  ScanLine,
  Sparkles,
  TrendingDown,
  ArrowRight,
  SlidersHorizontal,
  ReceiptText,
  Plus,
} from 'lucide-react';
import { ActiveView, CategoryBudget, Expense, PeriodFilter } from '../types/finance';
import { DAILY_SPENDING_OCTOBER, MONTHLY_INCOME } from '../data/mockFinanceData';
import { formatBRL, formatShortDate } from '../utils/formatters';
import { CategoryIcon, getCategoryColor } from './CategoryIcon';

interface DashboardViewProps {
  expenses: Expense[];
  budgets: CategoryBudget[];
  onNavigate: (view: ActiveView) => void;
  onOpenNewExpense: (initialMode?: 'scanner' | 'text' | 'manual') => void;
  onSelectExpense: (expense: Expense) => void;
  onApplyAiRebalance: () => void;
}

export function DashboardView({
  expenses,
  budgets,
  onNavigate,
  onOpenNewExpense,
  onSelectExpense,
  onApplyAiRebalance,
}: DashboardViewProps) {
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const [hoveredDay, setHoveredDay] = useState<{ day: string; amount: number } | null>(null);
  const [previewEmpty, setPreviewEmpty] = useState(false);
  const [previewSkeleton, setPreviewSkeleton] = useState(false);

  const periodMultiplier = period === 'month' ? 1 : period === '30d' ? 1.08 : 11.4;

  const totalSpent = useMemo(() => {
    const base = expenses.reduce((sum, e) => sum + e.amount, 0);
    return base * periodMultiplier;
  }, [expenses, periodMultiplier]);

  const totalIncome = MONTHLY_INCOME * periodMultiplier;
  const savedAmount = Math.max(0, totalIncome - totalSpent);
  const savedPct = totalIncome > 0 ? ((savedAmount / totalIncome) * 100).toFixed(1) : '0.0';
  const totalBudget = budgets.reduce((sum, b) => sum + b.limit, 0) * periodMultiplier;
  const remainingEstimate = Math.max(0, totalBudget - totalSpent + 800);

  const categoryTotals = useMemo(() => {
    const map: Record<string, number> = {};
    for (const e of expenses) {
      map[e.category] = (map[e.category] || 0) + e.amount * periodMultiplier;
    }
    return Object.entries(map)
      .map(([category, amount]) => ({
        category,
        amount,
        color: getCategoryColor(category),
        pct: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, periodMultiplier, totalSpent]);

  const maxDaily = useMemo(
    () => Math.max(...DAILY_SPENDING_OCTOBER.map((d) => d.amount), 1),
    []
  );

  // Build SVG Donut arcs
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

  const triggerSkeletonDemo = () => {
    setPreviewSkeleton(true);
    setTimeout(() => setPreviewSkeleton(false), 900);
  };

  if (previewSkeleton) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 rounded-lg bg-slate-200 dark:bg-[#1C2025]" />
          <div className="h-9 w-56 rounded-lg bg-slate-200 dark:bg-[#1C2025]" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 h-56 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
          <div className="lg:col-span-5 h-56 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
          <div className="lg:col-span-5 h-72 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
          <div className="lg:col-span-7 h-72 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
        </div>
      </div>
    );
  }

  if (expenses.length === 0 || previewEmpty) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
              Bom dia, Lucas
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Sua conta está pronta para conciliação automática com IA.
            </p>
          </div>
          {previewEmpty && (
            <button
              type="button"
              onClick={() => setPreviewEmpty(false)}
              className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-[#222C38] text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#181C21]"
            >
              Voltar para dados de Outubro
            </button>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-10 sm:p-14 flex flex-col items-center text-center max-w-2xl mx-auto my-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mb-5">
            <ReceiptText className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Registre sua primeira despesa
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mt-2 leading-relaxed">
            Escaneie um cupom fiscal com a câmera, cole uma descrição em texto livre ou conecte sua conta via Open Finance para começar a acompanhar seus gastos.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button
              type="button"
              onClick={() => onOpenNewExpense('scanner')}
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
      {/* Greeting & Controls Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Bom dia, Lucas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Resumo financeiro consolidado · Outubro 2024 · Open Finance sincronizado
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-[#151B23] border border-slate-200 dark:border-[#222C38]">
            {(
              [
                { id: 'month', label: 'Mês Atual' },
                { id: '30d', label: 'Últimos 30d' },
                { id: 'year', label: 'Ano 2024' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriod(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  period === tab.id
                    ? 'bg-white dark:bg-[#222C38] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => onOpenNewExpense('scanner')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] hover:bg-slate-50 dark:hover:bg-[#1C2025] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
          >
            <ScanLine className="w-4 h-4 text-emerald-500" />
            <span>Escanear Recibo</span>
          </button>

          <button
            type="button"
            onClick={() => setPreviewEmpty(true)}
            className="px-2.5 py-2 rounded-xl text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
            title="Visualizar estado vazio para novo usuário"
          >
            Estado Vazio
          </button>
          <button
            type="button"
            onClick={triggerSkeletonDemo}
            className="px-2.5 py-2 rounded-xl text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors whitespace-nowrap"
            title="Visualizar skeleton loading"
          >
            Skeleton
          </button>
        </div>
      </div>

      {/* Row 1: Hero KPI (7 cols) + AI Insight Card (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                Total Gasto no Período
              </span>
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-[#4EDEA3] font-mono-tabular">
                <TrendingDown className="w-3.5 h-3.5" />
                -8,4% vs. mês anterior
              </span>
            </div>

            <div className="mt-2 flex items-baseline gap-3 flex-wrap">
              <span className="text-3xl sm:text-4xl font-bold tracking-tight text-slate-900 dark:text-white font-mono-tabular">
                {formatBRL(totalSpent)}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                Saldo livre estimado: {formatBRL(remainingEstimate)}
              </span>
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-100 dark:border-[#222C38] grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Receitas</p>
              <p className="text-base font-semibold text-slate-900 dark:text-white font-mono-tabular mt-0.5">
                {formatBRL(totalIncome)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Economizado</p>
              <p className="text-base font-semibold text-emerald-600 dark:text-[#4EDEA3] font-mono-tabular mt-0.5">
                {formatBRL(savedAmount)} ({savedPct}%)
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-xs text-slate-500 dark:text-slate-400">Ritmo Diário</p>
              <p className="text-base font-semibold text-slate-900 dark:text-white font-mono-tabular mt-0.5">
                {formatBRL(totalSpent / 24)}/dia
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
                Insight da IA Trocado
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                98% confiança
              </span>
            </div>

            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mt-3">
              Pico no Delivery de Fim de Semana
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
              Você gastou <span className="font-semibold text-slate-900 dark:text-white">+32%</span> com Alimentação este mês, concentrado em pedidos de sexta a domingo (+R$ 340,00). Reduzir 2 pedidos economiza{' '}
              <span className="font-semibold text-emerald-600 dark:text-[#4EDEA3] font-mono-tabular">
                R$ 280,00/mês
              </span>
              .
            </p>
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={onApplyAiRebalance}
              className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              Ajustar Meta (-R$ 280)
            </button>
            <button
              type="button"
              onClick={() => onNavigate('assistant')}
              className="px-3.5 py-2 rounded-lg border border-slate-200 dark:border-[#222C38] hover:bg-slate-100 dark:hover:bg-[#1C2025] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap"
            >
              Conversar com IA
            </button>
          </div>
        </section>
      </div>

      {/* Row 2: Gastos por Categoria (5 cols) + Gastos Diários (7 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Gastos por Categoria
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {categoryTotals.length} categorias ativas
              </p>
            </div>
            {categoryTotals[0] && (
              <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
                Maior: {categoryTotals[0].category} ({categoryTotals[0].pct.toFixed(1)}%)
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
                    key={seg.category}
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
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {categoryTotals[0]?.category || 'Total'}
                </span>
                <span className="text-sm font-bold text-slate-900 dark:text-white font-mono-tabular">
                  {categoryTotals[0] ? `${categoryTotals[0].pct.toFixed(1)}%` : '0%'}
                </span>
              </div>
            </div>

            <div className="flex-1 w-full space-y-2.5">
              {categoryTotals.slice(0, 6).map((cat) => (
                <div key={cat.category} className="flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                      {cat.category}
                    </span>
                    <span className="text-slate-400 dark:text-slate-500 font-mono-tabular">
                      {cat.pct.toFixed(1)}%
                    </span>
                  </div>
                  <span className="font-semibold text-slate-900 dark:text-white font-mono-tabular whitespace-nowrap">
                    {formatBRL(cat.amount)}
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
                01 a 24 de Outubro · Picos nos dias 03 e 05
              </p>
            </div>
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 font-mono-tabular">
              {hoveredDay
                ? `Dia ${hoveredDay.day}/10: ${formatBRL(hoveredDay.amount)}`
                : `Média: ${formatBRL(160.1)}/dia`}
            </span>
          </div>

          <div className="h-44 flex items-end gap-1.5 sm:gap-2.5 pt-4">
            {DAILY_SPENDING_OCTOBER.map((d) => {
              const heightPct = Math.max(8, Math.round((d.amount / maxDaily) * 100));
              const isPeak = d.amount >= 450;
              return (
                <button
                  key={d.day}
                  type="button"
                  onMouseEnter={() => setHoveredDay(d)}
                  onMouseLeave={() => setHoveredDay(null)}
                  onFocus={() => setHoveredDay(d)}
                  onBlur={() => setHoveredDay(null)}
                  className="flex-1 flex flex-col items-center gap-2 h-full justify-end group focus-visible:outline-none"
                  aria-label={`Dia ${d.day} de outubro: ${formatBRL(d.amount)}`}
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
                    {d.day === '24' ? 'Hoje' : d.day}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Row 3: Metas & Orçamentos (5 cols) + Últimas Despesas (7 cols) */}
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

          <div className="space-y-4">
            {budgets.slice(0, 5).map((b) => {
              const spent = expenses
                .filter((e) => e.category === b.category)
                .reduce((s, e) => s + e.amount, 0);
              const pct = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
              const isDanger = pct > 90;
              return (
                <div key={b.id} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {b.category}
                    </span>
                    <div className="flex items-center gap-2 font-mono-tabular">
                      <span className="text-slate-900 dark:text-white font-semibold">
                        {formatBRL(spent)}
                      </span>
                      <span className="text-slate-400 dark:text-slate-500">
                        / {formatBRL(b.limit)}
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
                        backgroundColor: isDanger ? '#EF4444' : b.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Últimas Despesas
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Categorizadas e validadas por IA
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
              const isAi = exp.origin !== 'manual';
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
                        backgroundColor: `${getCategoryColor(exp.category)}18`,
                        color: getCategoryColor(exp.category),
                      }}
                    >
                      <CategoryIcon category={exp.category} className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {exp.merchant}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {exp.category} · {formatShortDate(exp.date)} ·{' '}
                        <span className={isAi ? 'text-violet-600 dark:text-violet-300' : ''}>
                          {isAi ? 'Registrado por IA' : 'Manual'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white font-mono-tabular">
                      -{formatBRL(exp.amount)}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {exp.paymentMethod}
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
