import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Repeat, Store, BarChart3, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { ReportsResponse } from '../types/finance';
import {
  formatCentsBRL,
  formatDateBR,
  getCurrentMonthISO,
  getTodaySaoPauloISO,
  shiftMonthISO,
} from '../utils/formatters';
import { apiFetch, downloadAuthenticatedCsv } from '../lib/api';

interface ReportsViewProps {
  userId?: string;
  onNotify?: (toast: { type: 'success' | 'error'; message: string }) => void;
}

type PeriodPreset = '6m' | '12m' | 'year' | 'custom';

export function ReportsView({ userId, onNotify }: ReportsViewProps) {
  const todayISO = getTodaySaoPauloISO();
  const currentMonth = getCurrentMonthISO();

  const [preset, setPreset] = useState<PeriodPreset>('6m');
  const [customFrom, setCustomFrom] = useState(`${shiftMonthISO(currentMonth, -5)}-01`);
  const [customTo, setCustomTo] = useState(todayISO);
  const [isExporting, setIsExporting] = useState(false);

  const { from, to } = useMemo(() => {
    if (preset === '6m') {
      return { from: `${shiftMonthISO(currentMonth, -5)}-01`, to: todayISO };
    }
    if (preset === '12m') {
      return { from: `${shiftMonthISO(currentMonth, -11)}-01`, to: todayISO };
    }
    if (preset === 'year') {
      return { from: `${todayISO.slice(0, 4)}-01-01`, to: todayISO };
    }
    const safeFrom = customFrom && customFrom <= (customTo || todayISO) ? customFrom : todayISO;
    const safeTo = customTo || todayISO;
    return { from: safeFrom, to: safeTo };
  }, [preset, currentMonth, todayISO, customFrom, customTo]);

  const reportsQuery = useQuery({
    queryKey: ['reports', userId, from, to],
    queryFn: () =>
      apiFetch<ReportsResponse>(
        `/api/reports?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
      ),
    enabled: Boolean(userId && from && to && from <= to),
  });

  const data = reportsQuery.data;
  const monthlyByCategory = data?.monthlyByCategory ?? [];
  const topMerchants = data?.topMerchants ?? [];
  const recurring = data?.recurring ?? [];

  const maxMonthCents = useMemo(
    () => Math.max(...monthlyByCategory.map((m) => m.totalCents), 1),
    [monthlyByCategory]
  );

  const legendCategories = useMemo(() => {
    const map = new Map<string, { name: string; color: string }>();
    for (const m of monthlyByCategory) {
      for (const c of m.categories) {
        if (!map.has(c.categoryId)) {
          map.set(c.categoryId, { name: c.categoryName, color: c.categoryColor });
        }
      }
    }
    return Array.from(map.values());
  }, [monthlyByCategory]);

  const handleExportCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await downloadAuthenticatedCsv(from, to);
      onNotify?.({ type: 'success', message: 'Arquivo CSV baixado!' });
    } catch (err) {
      onNotify?.({
        type: 'error',
        message: err instanceof Error ? err.message : 'Não foi possível exportar o CSV.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  if (reportsQuery.isLoading) {
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
            Comparativo mensal por categoria, top 10 estabelecimentos e recorrências em 3+ meses.
          </p>
        </div>

        <button
          type="button"
          disabled={isExporting || (data?.expenseCount ?? 0) === 0}
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-[#0B0F14] font-semibold text-sm transition-colors self-start md:self-auto whitespace-nowrap"
        >
          {isExporting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Download className="w-4 h-4" />
          )}
          {isExporting ? 'Exportando...' : 'Exportar CSV'}
        </button>
      </div>

      {/* Period Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-4">
        <div className="inline-flex flex-wrap p-1 rounded-xl bg-slate-100 dark:bg-[#0B0F14] border border-slate-200 dark:border-[#222C38] gap-1">
          {[
            { id: '6m', label: 'Últimos 6 meses' },
            { id: '12m', label: 'Últimos 12 meses' },
            { id: 'year', label: `Ano ${todayISO.slice(0, 4)}` },
            { id: 'custom', label: 'Personalizado' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreset(item.id as PeriodPreset)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                preset === item.id
                  ? 'bg-white dark:bg-[#222C38] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {preset === 'custom' ? (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label className="text-slate-500 dark:text-slate-400" htmlFor="report-from">
              De:
            </label>
            <input
              id="report-from"
              type="date"
              value={customFrom}
              max={customTo || todayISO}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-slate-900 dark:text-white font-mono-tabular"
            />
            <label className="text-slate-500 dark:text-slate-400" htmlFor="report-to">
              Até:
            </label>
            <input
              id="report-to"
              type="date"
              value={customTo}
              min={customFrom}
              max={todayISO}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-slate-900 dark:text-white font-mono-tabular"
            />
          </div>
        ) : (
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular">
            Período: {formatDateBR(from)} até {formatDateBR(to)}
          </span>
        )}
      </div>

      {reportsQuery.isError ? (
        <div className="rounded-2xl border border-red-500/30 bg-white dark:bg-[#151B23] p-8 text-center space-y-3">
          <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Não foi possível carregar os relatórios
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {reportsQuery.error instanceof Error
              ? reportsQuery.error.message
              : 'Erro ao consultar relatórios.'}
          </p>
          <button
            type="button"
            onClick={() => reportsQuery.refetch()}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Tentar novamente
          </button>
        </div>
      ) : !data || data.expenseCount === 0 ? (
        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-12 text-center space-y-2">
          <BarChart3 className="w-8 h-8 text-emerald-500 mx-auto" />
          <p className="text-sm font-medium text-slate-900 dark:text-white">
            Nenhuma despesa encontrada neste período.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ajuste o intervalo de datas acima ou registre novas despesas para visualizar gráficos e rankings.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Despesas no Período</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white font-mono-tabular mt-1">
                {formatCentsBRL(data.totalCents)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono-tabular">
                {data.expenseCount} {data.expenseCount === 1 ? 'lançamento' : 'lançamentos'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Estabelecimento Líder</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white truncate mt-1">
                {topMerchants[0]?.merchant || '—'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular mt-1">
                {topMerchants[0] ? formatCentsBRL(topMerchants[0].totalCents) : ''}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Recorrências Detectadas</p>
              <p className="text-xl font-bold text-violet-600 dark:text-violet-300 font-mono-tabular mt-1">
                {recurring.length}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Valor similar (±10%) em 3+ meses
              </p>
            </div>
          </div>

          <section className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Comparativo Mensal por Categoria
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Total mensal em barras empilhadas por categoria
                </p>
              </div>

              {legendCategories.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {legendCategories.map((cat) => (
                    <div key={cat.name} className="inline-flex items-center gap-1.5 text-xs">
                      <span
                        className="w-2.5 h-2.5 rounded-xs shrink-0"
                        style={{ backgroundColor: cat.color }}
                      />
                      <span className="text-slate-600 dark:text-slate-300">{cat.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-end gap-4 sm:gap-8 h-60 pt-4 overflow-x-auto">
              {monthlyByCategory.map((m) => {
                const [y, mon] = m.month.split('-');
                return (
                  <div
                    key={m.month}
                    className="flex-1 min-w-[72px] flex flex-col items-center h-full justify-end gap-2"
                  >
                    <span className="text-xs font-mono-tabular font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                      {formatCentsBRL(m.totalCents)}
                    </span>
                    <div className="w-full max-w-[68px] flex-1 flex flex-col justify-end rounded-t-xl overflow-hidden bg-slate-100/40 dark:bg-[#0B0F14]/40">
                      {m.categories.map((seg) => {
                        const heightPct = (seg.totalCents / maxMonthCents) * 100;
                        return (
                          <div
                            key={seg.categoryId}
                            style={{
                              height: `${heightPct}%`,
                              backgroundColor: seg.categoryColor,
                            }}
                            title={`${seg.categoryName}: ${formatCentsBRL(seg.totalCents)}`}
                            className="w-full border-b border-white/20 dark:border-[#0B0F14]/30 last:border-b-0 transition-all duration-300"
                          />
                        );
                      })}
                    </div>
                    <span className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400 whitespace-nowrap">
                      {mon}/{y}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-emerald-500" />
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Top 10 Estabelecimentos
                  </h2>
                </div>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-mono-tabular">
                  {topMerchants.length} locais
                </span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-[#222C38]">
                {topMerchants.map((item, idx) => (
                  <div key={`${item.merchant}-${idx}`} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-[#1C2025] text-xs font-mono-tabular font-semibold flex items-center justify-center text-slate-600 dark:text-slate-300 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {item.merchant}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.categoryName} · {item.expenseCount}{' '}
                          {item.expenseCount === 1 ? 'lançamento' : 'lançamentos'}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white font-mono-tabular shrink-0">
                      {formatCentsBRL(item.totalCents)}
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

              {recurring.length === 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400 py-4 leading-relaxed">
                  Nenhum estabelecimento com cobranças de valor similar (±10%) em 3 ou mais meses diferentes neste período.
                </p>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-[#222C38]">
                  {recurring.map((sub) => (
                    <div key={sub.merchant} className="py-3.5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {sub.merchant}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {sub.categoryName} · {sub.monthsCount} meses distintos · {sub.occurrences}{' '}
                          ocorrências
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
