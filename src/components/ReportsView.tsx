import React, { useMemo } from 'react';
import { Download, Repeat, Store, BarChart3 } from 'lucide-react';
import { Category, Expense } from '../types/finance';
import { exportExpensesToCSV, formatCentsBRL } from '../utils/formatters';
import { getCategoryColor } from './CategoryIcon';

interface ReportsViewProps {
  expenses: Expense[];
  categories: Category[];
  isLoading?: boolean;
}

export function ReportsView({
  expenses,
  categories,
  isLoading = false,
}: ReportsViewProps) {
  const categoryMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );

  const totalSpentCents = useMemo(
    () => expenses.reduce((s, e) => s + e.amountCents, 0),
    [expenses]
  );

  const merchantRanking = useMemo(() => {
    const map = new Map<string, { amountCents: number; count: number; categoryName: string }>();
    for (const e of expenses) {
      const catName = e.categoryName || categoryMap.get(e.categoryId)?.name || 'Outros';
      const existing = map.get(e.merchant);
      if (existing) {
        existing.amountCents += e.amountCents;
        existing.count += 1;
      } else {
        map.set(e.merchant, { amountCents: e.amountCents, count: 1, categoryName: catName });
      }
    }
    return Array.from(map.entries())
      .map(([merchant, info]) => ({ merchant, ...info }))
      .sort((a, b) => b.amountCents - a.amountCents)
      .slice(0, 6);
  }, [expenses, categoryMap]);

  const recurringCandidates = useMemo(() => {
    const map = new Map<string, { count: number; totalCents: number; categoryName: string }>();
    for (const e of expenses) {
      const catName = e.categoryName || categoryMap.get(e.categoryId)?.name || 'Outros';
      const existing = map.get(e.merchant);
      if (existing) {
        existing.count += 1;
        existing.totalCents += e.amountCents;
      } else {
        map.set(e.merchant, { count: 1, totalCents: e.amountCents, categoryName: catName });
      }
    }
    return Array.from(map.entries())
      .filter(([, info]) => info.count >= 2)
      .map(([merchant, info]) => ({
        merchant,
        count: info.count,
        avgCents: Math.round(info.totalCents / info.count),
        categoryName: info.categoryName,
      }));
  }, [expenses, categoryMap]);

  const monthlyStacked = useMemo(() => {
    const monthBuckets = new Map<
      string,
      { totalCents: number; byCategory: Map<string, { name: string; color: string; cents: number }> }
    >();

    for (const e of expenses) {
      const ym = e.expenseDate.slice(0, 7);
      const cat = categoryMap.get(e.categoryId);
      const catName = e.categoryName || cat?.name || 'Outros';
      const catColor = e.categoryColor || cat?.color || getCategoryColor(catName);

      if (!monthBuckets.has(ym)) {
        monthBuckets.set(ym, { totalCents: 0, byCategory: new Map() });
      }
      const bucket = monthBuckets.get(ym)!;
      bucket.totalCents += e.amountCents;
      const existingCat = bucket.byCategory.get(catName);
      if (existingCat) {
        existingCat.cents += e.amountCents;
      } else {
        bucket.byCategory.set(catName, { name: catName, color: catColor, cents: e.amountCents });
      }
    }

    return Array.from(monthBuckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([ym, info]) => {
        const [y, m] = ym.split('-');
        return {
          ym,
          label: `${m}/${y}`,
          totalCents: info.totalCents,
          segments: Array.from(info.byCategory.values()),
        };
      });
  }, [expenses, categoryMap]);

  const maxMonthCents = useMemo(
    () => Math.max(...monthlyStacked.map((m) => m.totalCents), 1),
    [monthlyStacked]
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 rounded-lg bg-slate-200 dark:bg-[#1C2025]" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-24 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
          <div className="h-24 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
          <div className="h-24 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
        </div>
        <div className="h-72 rounded-2xl bg-slate-200 dark:bg-[#151B23]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Relatórios & Análise de Tendências
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Comparativo mensal por categoria, ranking de estabelecimentos e recorrências detectadas.
          </p>
        </div>

        <button
          type="button"
          disabled={expenses.length === 0}
          onClick={() => exportExpensesToCSV(expenses)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-[#0B0F14] font-semibold text-sm transition-colors self-start md:self-auto whitespace-nowrap"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      {expenses.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-12 text-center space-y-2">
          <BarChart3 className="w-8 h-8 text-emerald-500 mx-auto" />
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            Sem dados suficientes para relatórios.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Registre suas primeiras despesas para visualizar comparativos mensais e rankings.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Despesas Totais</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white font-mono-tabular mt-1">
                {formatCentsBRL(totalSpentCents)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                {expenses.length} lançamentos
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Estabelecimento Líder</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white truncate mt-1">
                {merchantRanking[0]?.merchant || '—'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular mt-1">
                {merchantRanking[0] ? formatCentsBRL(merchantRanking[0].amountCents) : ''}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Recorrências Detectadas</p>
              <p className="text-xl font-bold text-violet-600 dark:text-violet-300 font-mono-tabular mt-1">
                {recurringCandidates.length}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Estabelecimentos com 2+ lançamentos
              </p>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 space-y-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Comparativo Mensal por Categoria
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Barras empilhadas baseadas nas despesas registradas
              </p>
            </div>

            <div className="flex items-end gap-4 sm:gap-8 h-56 pt-4 overflow-x-auto">
              {monthlyStacked.map((m) => (
                <div
                  key={m.ym}
                  className="flex-1 min-w-[72px] flex flex-col items-center h-full justify-end gap-2"
                >
                  <span className="text-xs font-mono-tabular font-semibold text-slate-700 dark:text-slate-200">
                    {formatCentsBRL(m.totalCents)}
                  </span>
                  <div className="w-full max-w-[68px] flex-1 flex flex-col justify-end rounded-t-xl overflow-hidden">
                    {m.segments.map((seg) => {
                      const heightPct = (seg.cents / maxMonthCents) * 100;
                      return (
                        <div
                          key={seg.name}
                          style={{
                            height: `${heightPct}%`,
                            backgroundColor: seg.color,
                          }}
                          title={`${seg.name}: ${formatCentsBRL(seg.cents)}`}
                          className="w-full border-b border-white/20 dark:border-[#0B0F14]/30 last:border-b-0"
                        />
                      );
                    })}
                  </div>
                  <span className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400 whitespace-nowrap">
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Store className="w-4 h-4 text-emerald-500" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Ranking de Estabelecimentos
                </h2>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-[#222C38]">
                {merchantRanking.map((item, idx) => (
                  <div key={item.merchant} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-[#1C2025] text-xs font-mono-tabular font-semibold flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {item.merchant}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.categoryName} · {item.count}{' '}
                          {item.count === 1 ? 'lançamento' : 'lançamentos'}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white font-mono-tabular shrink-0">
                      {formatCentsBRL(item.amountCents)}
                    </span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 space-y-4">
              <div className="flex items-center gap-2">
                <Repeat className="w-4 h-4 text-violet-500" />
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Gastos Recorrentes Detectados
                </h2>
              </div>

              {recurringCandidates.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
                  Nenhum estabelecimento recorrente detectado ainda.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#222C38]">
                  {recurringCandidates.map((sub) => (
                    <div key={sub.merchant} className="py-3.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {sub.merchant}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {sub.categoryName} · {sub.count} ocorrências
                        </p>
                      </div>
                      <span className="text-sm font-bold text-slate-900 dark:text-white font-mono-tabular shrink-0">
                        ~{formatCentsBRL(sub.avgCents)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
