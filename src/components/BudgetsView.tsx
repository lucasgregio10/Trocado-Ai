import React, { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Wallet } from 'lucide-react';
import { Budget, Category } from '../types/finance';
import { formatCentsBRL, getCurrentMonthSaoPaulo } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';

interface BudgetsViewProps {
  budgets: Budget[];
  categories: Category[];
  isLoading?: boolean;
  onUpdateBudgetLimit: (categoryId: string, newLimitCents: number) => void;
}

export function BudgetsView({
  budgets,
  categories,
  isLoading = false,
  onUpdateBudgetLimit,
}: BudgetsViewProps) {
  const [filter, setFilter] = useState<'all' | 'alert' | 'healthy'>('all');
  const currentMonth = getCurrentMonthSaoPaulo();

  const mergedBudgets = useMemo(() => {
    const budgetMap = new Map(budgets.map((b) => [b.categoryId, b]));
    return categories.map((cat) => {
      const existing = budgetMap.get(cat.id);
      const monthlyLimitCents = existing?.monthlyLimitCents ?? 0;
      const spentCents = existing?.spentCents ?? 0;
      const pct = monthlyLimitCents > 0 ? (spentCents / monthlyLimitCents) * 100 : 0;
      const isAlert = monthlyLimitCents > 0 && pct >= 90;
      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryColor: cat.color,
        categoryIcon: cat.icon,
        monthlyLimitCents,
        spentCents,
        pct,
        isAlert,
      };
    });
  }, [budgets, categories]);

  const totalSpentCents = useMemo(
    () => mergedBudgets.reduce((s, b) => s + b.spentCents, 0),
    [mergedBudgets]
  );
  const totalAllocatedCents = useMemo(
    () => mergedBudgets.reduce((s, b) => s + b.monthlyLimitCents, 0),
    [mergedBudgets]
  );

  const usedPct = totalAllocatedCents > 0 ? (totalSpentCents / totalAllocatedCents) * 100 : 0;
  const remainingTotalCents = Math.max(0, totalAllocatedCents - totalSpentCents);

  const alertCount = mergedBudgets.filter((b) => b.isAlert).length;
  const visibleBudgets = mergedBudgets.filter((b) => {
    if (filter === 'alert') return b.isAlert;
    if (filter === 'healthy') return !b.isAlert;
    return true;
  });

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 rounded-lg bg-slate-200 dark:bg-[#1C2025]" />
        <div className="h-36 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="h-44 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
          <div className="h-44 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Orçamentos Mensais
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Defina limites mensais por categoria para {currentMonth.label}.
        </p>
      </div>

      {/* Summary Row */}
      <section className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Orçamento Total Alocado</p>
            <div className="flex items-baseline gap-2 mt-1 flex-wrap">
              <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-mono-tabular">
                {formatCentsBRL(totalSpentCents)}
              </span>
              <span className="text-sm text-slate-500 dark:text-slate-400 font-mono-tabular">
                / {formatCentsBRL(totalAllocatedCents)}
              </span>
            </div>
          </div>
          <span
            className={`text-sm font-bold font-mono-tabular ${
              usedPct > 90 ? 'text-amber-500' : 'text-emerald-500'
            }`}
          >
            {usedPct.toFixed(1)}% usado
          </span>
        </div>

        <div className="h-3 rounded-full bg-slate-100 dark:bg-[#1C2025] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, usedPct)}%`,
              backgroundColor: usedPct > 90 ? '#EF4444' : '#10B981',
            }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <span>Restam {formatCentsBRL(remainingTotalCents)}</span>
          <span>Ciclo: {currentMonth.label}</span>
        </div>
      </section>

      {mergedBudgets.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-12 text-center space-y-2">
          <Wallet className="w-8 h-8 text-emerald-500 mx-auto" />
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            Nenhuma categoria disponível para orçamento.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Crie categorias em Configurações ou autentique sua conta para carregar suas categorias padrão.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Categorias Orçamentárias ({mergedBudgets.length})
            </h2>
            <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-[#151B23] border border-slate-200 dark:border-[#222C38]">
              {[
                { id: 'all', label: `Todas (${mergedBudgets.length})` },
                { id: 'alert', label: `Em Alerta (${alertCount})` },
                { id: 'healthy', label: `Controladas (${mergedBudgets.length - alertCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilter(tab.id as 'all' | 'alert' | 'healthy')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    filter === tab.id
                      ? 'bg-white dark:bg-[#222C38] text-slate-900 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {visibleBudgets.map((b) => {
              const isDanger = b.monthlyLimitCents > 0 && b.pct > 90;
              const remainingCents = Math.max(0, b.monthlyLimitCents - b.spentCents);
              const limitReais = Math.round(b.monthlyLimitCents / 100);
              return (
                <article
                  key={b.categoryId}
                  className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5 space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: `${b.categoryColor}20`, color: b.categoryColor }}
                      >
                        <CategoryIcon category={b.categoryName} className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {b.categoryName}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {b.monthlyLimitCents > 0 ? 'Limite mensal ativo' : 'Sem limite definido'}
                        </p>
                      </div>
                    </div>

                    {b.monthlyLimitCents > 0 && (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold font-mono-tabular ${
                          isDanger ? 'text-red-500' : 'text-emerald-600 dark:text-[#4EDEA3]'
                        }`}
                      >
                        {isDanger ? (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        {b.pct > 100 ? 'Excedido' : `${b.pct.toFixed(1)}%`}
                      </span>
                    )}
                  </div>

                  <div className="h-2.5 rounded-full bg-slate-100 dark:bg-[#1C2025] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.min(100, b.pct)}%`,
                        backgroundColor: isDanger ? '#EF4444' : b.categoryColor,
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono-tabular">
                    <span className="text-slate-700 dark:text-slate-300">
                      Gasto: <strong>{formatCentsBRL(b.spentCents)}</strong>
                    </span>
                    <span className="text-slate-500 dark:text-slate-400">
                      Restante: {formatCentsBRL(remainingCents)}
                    </span>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-[#222C38] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <label
                        htmlFor={`slider-${b.categoryId}`}
                        className="text-slate-500 dark:text-slate-400 font-medium"
                      >
                        Definir limite mensal
                      </label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">R$</span>
                        <input
                          type="number"
                          min={0}
                          max={50000}
                          step={50}
                          value={limitReais}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (Number.isFinite(val) && val >= 0) {
                              onUpdateBudgetLimit(b.categoryId, Math.round(val * 100));
                            }
                          }}
                          aria-label={`Valor limite de ${b.categoryName}`}
                          className="w-24 px-2 py-1 rounded-lg border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-xs font-mono-tabular font-semibold text-right text-slate-900 dark:text-white"
                        />
                      </div>
                    </div>
                    <input
                      id={`slider-${b.categoryId}`}
                      type="range"
                      min={0}
                      max={5000}
                      step={50}
                      value={Math.min(5000, limitReais)}
                      onChange={(e) =>
                        onUpdateBudgetLimit(b.categoryId, Number(e.target.value) * 100)
                      }
                      className="w-full accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
