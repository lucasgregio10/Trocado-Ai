import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Save, Trash2, Wallet } from 'lucide-react';
import { Budget, Category } from '../types/finance';
import { formatCentsBRL, getCurrentMonthSaoPaulo } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';

interface BudgetsViewProps {
  budgets: Budget[];
  categories: Category[];
  isLoading?: boolean;
  isSavingCategoryId?: string | null;
  onSaveBudgetLimit: (categoryId: string, newLimitCents: number) => Promise<void>;
  onDeleteBudgetLimit: (categoryId: string) => Promise<void>;
}

function getBudgetStatusColors(pct: number, hasLimit: boolean) {
  if (!hasLimit) {
    return {
      bar: '#64748B',
      text: 'text-slate-500 dark:text-slate-400',
      isWarningOrOver: false,
    };
  }
  if (pct > 100) {
    return {
      bar: '#EF4444',
      text: 'text-red-500',
      isWarningOrOver: true,
    };
  }
  if (pct >= 80) {
    return {
      bar: '#F59E0B',
      text: 'text-amber-600 dark:text-amber-400',
      isWarningOrOver: true,
    };
  }
  return {
    bar: '#10B981',
    text: 'text-emerald-600 dark:text-[#4EDEA3]',
    isWarningOrOver: false,
  };
}

export function BudgetsView({
  budgets,
  categories,
  isLoading = false,
  isSavingCategoryId = null,
  onSaveBudgetLimit,
  onDeleteBudgetLimit,
}: BudgetsViewProps) {
  const [filter, setFilter] = useState<'all' | 'alert' | 'healthy'>('all');
  const [draftLimitsReais, setDraftLimitsReais] = useState<Record<string, number>>({});
  const currentMonth = getCurrentMonthSaoPaulo();

  const mergedBudgets = useMemo(() => {
    const budgetMap = new Map(budgets.map((b) => [b.categoryId, b]));
    return categories.map((cat) => {
      const existing = budgetMap.get(cat.id);
      const savedLimitCents = existing?.monthlyLimitCents ?? 0;
      const spentCents = existing?.spentCents ?? 0;
      const draftReais = draftLimitsReais[cat.id];
      const effectiveLimitCents =
        draftReais !== undefined ? Math.round(draftReais * 100) : savedLimitCents;
      const pct = savedLimitCents > 0 ? (spentCents / savedLimitCents) * 100 : 0;
      const isAlert = savedLimitCents > 0 && pct >= 80;
      const isDirty = draftReais !== undefined && effectiveLimitCents !== savedLimitCents;

      return {
        categoryId: cat.id,
        categoryName: cat.name,
        categoryColor: cat.color,
        categoryIcon: cat.icon,
        savedLimitCents,
        effectiveLimitCents,
        spentCents,
        pct,
        isAlert,
        isDirty,
      };
    });
  }, [budgets, categories, draftLimitsReais]);

  useEffect(() => {
    setDraftLimitsReais((prev) => {
      const next: Record<string, number> = {};
      let changed = false;
      for (const [catId, val] of Object.entries(prev)) {
        const b = budgets.find((item) => item.categoryId === catId);
        const savedCents = b?.monthlyLimitCents ?? 0;
        if (Math.round(val * 100) !== savedCents) {
          next[catId] = val;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [budgets]);

  const totalSpentCents = useMemo(
    () => mergedBudgets.reduce((s, b) => s + b.spentCents, 0),
    [mergedBudgets]
  );
  const totalAllocatedCents = useMemo(
    () => mergedBudgets.reduce((s, b) => s + b.savedLimitCents, 0),
    [mergedBudgets]
  );

  const usedPct = totalAllocatedCents > 0 ? (totalSpentCents / totalAllocatedCents) * 100 : 0;
  const totalColors = getBudgetStatusColors(usedPct, totalAllocatedCents > 0);
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
          <span className={`text-sm font-bold font-mono-tabular ${totalColors.text}`}>
            {totalAllocatedCents > 0 ? `${usedPct.toFixed(1)}% usado` : 'Sem limites'}
          </span>
        </div>

        <div className="h-3 rounded-full bg-slate-100 dark:bg-[#1C2025] overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${Math.min(100, usedPct)}%`,
              backgroundColor: totalColors.bar,
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
            Crie categorias em Configurações para definir limites mensais.
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
              const colors = getBudgetStatusColors(b.pct, b.savedLimitCents > 0);
              const remainingCents = Math.max(0, b.savedLimitCents - b.spentCents);
              const limitReais = Math.round(b.effectiveLimitCents / 100);
              const isSavingThis = isSavingCategoryId === b.categoryId;

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
                        <CategoryIcon category={b.categoryName} icon={b.categoryIcon} className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                          {b.categoryName}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {b.savedLimitCents > 0
                            ? `Limite salvo: ${formatCentsBRL(b.savedLimitCents)}`
                            : 'Sem limite definido'}
                        </p>
                      </div>
                    </div>

                    {b.savedLimitCents > 0 && (
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold font-mono-tabular ${colors.text}`}
                      >
                        {colors.isWarningOrOver ? (
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
                        backgroundColor: colors.bar,
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

                  <div className="pt-3 border-t border-slate-100 dark:border-[#222C38] space-y-2.5">
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
                          max={1000000}
                          step={50}
                          value={limitReais}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (Number.isFinite(val) && val >= 0) {
                              setDraftLimitsReais((prev) => ({
                                ...prev,
                                [b.categoryId]: Math.min(1_000_000, val),
                              }));
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
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setDraftLimitsReais((prev) => ({
                          ...prev,
                          [b.categoryId]: val,
                        }));
                      }}
                      className="w-full accent-emerald-500 cursor-pointer"
                    />

                    <div className="flex items-center justify-end gap-2 pt-1">
                      {b.savedLimitCents > 0 && (
                        <button
                          type="button"
                          disabled={isSavingThis}
                          onClick={async () => {
                            await onDeleteBudgetLimit(b.categoryId);
                            setDraftLimitsReais((prev) => {
                              const next = { ...prev };
                              delete next[b.categoryId];
                              return next;
                            });
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 disabled:opacity-50 text-xs font-medium transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Remover
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={
                          isSavingThis ||
                          (!b.isDirty && b.effectiveLimitCents === b.savedLimitCents) ||
                          b.effectiveLimitCents <= 0
                        }
                        onClick={async () => {
                          if (b.effectiveLimitCents > 0) {
                            await onSaveBudgetLimit(b.categoryId, b.effectiveLimitCents);
                          }
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:opacity-45 text-[#0B0F14] font-semibold text-xs transition-colors"
                      >
                        {isSavingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Save className="w-3.5 h-3.5" />
                        )}
                        {isSavingThis ? 'Salvando...' : 'Salvar limite'}
                      </button>
                    </div>
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
