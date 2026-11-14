import React, { useMemo, useState } from 'react';
import { Download, TrendingDown, Sparkles, Repeat, Store } from 'lucide-react';
import { Expense, PeriodFilter } from '../types/finance';
import { MONTHLY_INCOME } from '../data/mockFinanceData';
import { formatBRL, exportExpensesToCSV } from '../utils/formatters';
import { getCategoryColor } from './CategoryIcon';

interface ReportsViewProps {
  expenses: Expense[];
}

export function ReportsView({ expenses }: ReportsViewProps) {
  const [period, setPeriod] = useState<PeriodFilter>('month');
  const mult = period === 'month' ? 1 : period === '30d' ? 2.85 : 11.4;

  const totalSpent = useMemo(
    () => expenses.reduce((s, e) => s + e.amount, 0) * mult,
    [expenses, mult]
  );
  const totalIncome = MONTHLY_INCOME * mult;
  const netSavings = Math.max(0, totalIncome - totalSpent);
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

  const merchantRanking = useMemo(() => {
    const map: Record<string, { amount: number; count: number; category: string }> = {};
    for (const e of expenses) {
      if (!map[e.merchant]) {
        map[e.merchant] = { amount: 0, count: 0, category: e.category };
      }
      map[e.merchant].amount += e.amount * mult;
      map[e.merchant].count += 1;
    }
    return Object.entries(map)
      .map(([merchant, info]) => ({ merchant, ...info }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6);
  }, [expenses, mult]);

  const recurringSubscriptions = [
    { name: 'Condomínio & Aluguel Residencial', cadence: 'Mensal · Dia 03', amount: 1100.0, category: 'Moradia' },
    { name: 'Spotify Duo + Max + Disney+', cadence: 'Mensal · Dia 08', amount: 160.0, category: 'Lazer', alert: 'Max/Disney+ com baixo uso (38d)' },
    { name: 'Netflix Assinatura', cadence: 'Mensal · Dia 20', amount: 55.9, category: 'Lazer' },
  ];

  const monthlyStacked = [
    {
      label: 'Ago 2024',
      total: 3920,
      segments: [
        { category: 'Alimentação', value: 1280 },
        { category: 'Moradia', value: 1100 },
        { category: 'Transporte', value: 680 },
        { category: 'Lazer', value: 520 },
        { category: 'Saúde', value: 340 },
      ],
    },
    {
      label: 'Set 2024',
      total: 4195,
      segments: [
        { category: 'Alimentação', value: 1390 },
        { category: 'Moradia', value: 1100 },
        { category: 'Transporte', value: 596 },
        { category: 'Lazer', value: 653 },
        { category: 'Saúde', value: 456 },
      ],
    },
    {
      label: 'Out 2024',
      total: Math.round(expenses.reduce((s, e) => s + e.amount, 0)),
      segments: [
        { category: 'Alimentação', value: 1450.2 },
        { category: 'Moradia', value: 1100 },
        { category: 'Transporte', value: 480.3 },
        { category: 'Lazer', value: 362 },
        { category: 'Saúde', value: 250 },
      ],
    },
    {
      label: 'Nov (Proj. IA)',
      total: 3380,
      segments: [
        { category: 'Alimentação', value: 1180 },
        { category: 'Moradia', value: 1100 },
        { category: 'Transporte', value: 460 },
        { category: 'Lazer', value: 390 },
        { category: 'Saúde', value: 250 },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Relatórios & Análise de Tendências
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Comparativo mensal por categoria, ranking de estabelecimentos e assinaturas recorrentes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-[#151B23] border border-slate-200 dark:border-[#222C38]">
            {(
              [
                { id: 'month', label: 'Outubro 2024' },
                { id: '30d', label: 'Últimos 3 meses' },
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
            onClick={() => exportExpensesToCSV(expenses, 'trocado-relatorio-completo.csv')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-sm transition-colors whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Receita Consolidada</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white font-mono-tabular mt-1">
            {formatBRL(totalIncome)}
          </p>
          <p className="text-xs text-emerald-600 dark:text-[#4EDEA3] mt-1 font-mono-tabular">
            +4,2% vs. média trimestral
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Despesas Computadas</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white font-mono-tabular mt-1">
            {formatBRL(totalSpent)}
          </p>
          <p className="text-xs text-emerald-600 dark:text-[#4EDEA3] mt-1 font-mono-tabular">
            -8,7% otimizado via regras IA
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Economia Líquida</p>
          <p className="text-xl font-bold text-emerald-600 dark:text-[#4EDEA3] font-mono-tabular mt-1">
            {formatBRL(netSavings)}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-mono-tabular">
            {savingsRate.toFixed(1)}% taxa de poupança
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5">
          <p className="text-xs text-slate-500 dark:text-slate-400">Acurácia de Categorização</p>
          <p className="text-xl font-bold text-violet-600 dark:text-violet-300 font-mono-tabular mt-1">
            98,4%
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Auditorias de cupom NFC-e
          </p>
        </div>
      </div>

      {/* Stacked Monthly Comparison + AI Diagnostic */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Comparativo Mensal por Categoria
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Barras empilhadas de Agosto a Outubro + Projeção para Novembro
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-[#4EDEA3]">
              <TrendingDown className="w-3.5 h-3.5" />
              Nov: -12% gastos previstos
            </span>
          </div>

          <div className="grid grid-cols-4 gap-4 sm:gap-8 items-end h-56 pt-4">
            {monthlyStacked.map((m) => (
              <div key={m.label} className="flex flex-col items-center h-full justify-end gap-2">
                <span className="text-xs font-mono-tabular font-semibold text-slate-700 dark:text-slate-200">
                  {formatBRL(m.total)}
                </span>
                <div className="w-full max-w-[68px] flex-1 flex flex-col justify-end rounded-t-xl overflow-hidden">
                  {m.segments.map((seg) => {
                    const heightPct = (seg.value / 4500) * 100;
                    return (
                      <div
                        key={seg.category}
                        style={{
                          height: `${heightPct}%`,
                          backgroundColor: getCategoryColor(seg.category),
                        }}
                        title={`${seg.category}: ${formatBRL(seg.value)}`}
                        className="w-full border-b border-white/20 dark:border-[#0B0F14]/30 last:border-b-0"
                      />
                    );
                  })}
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                  {m.label}
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-100 dark:border-[#222C38] text-xs">
            {['Alimentação', 'Moradia', 'Transporte', 'Lazer', 'Saúde'].map((cat) => (
              <span key={cat} className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <span
                  className="w-2.5 h-2.5 rounded-xs"
                  style={{ backgroundColor: getCategoryColor(cat) }}
                />
                {cat}
              </span>
            ))}
          </div>
        </section>

        <section
          className="lg:col-span-4 rounded-2xl border border-violet-200 dark:border-violet-500/30 bg-white dark:bg-[#151B23] p-6 flex flex-col justify-between space-y-5"
          style={{
            backgroundImage:
              'radial-gradient(circle at top right, rgba(139, 92, 246, 0.12), transparent 65%)',
          }}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-violet-600 dark:text-violet-300">
              <Sparkles className="w-4 h-4" />
              Diagnóstico IA
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Padrão de Fim de Semana (+38%)
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                Sexta e sábado concentram 73% dos desvios de delivery e mobilidade urbana.
              </p>
            </div>
            <div className="p-4 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#101419]">
              <p className="text-xs text-slate-500 dark:text-slate-400">Economia anual projetada</p>
              <p className="text-xl font-bold text-emerald-600 dark:text-[#4EDEA3] font-mono-tabular mt-0.5">
                R$ 3.420,00 / ano
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Adotando redução de streamings ociosos e cashback em mercado.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* Ranking de Estabelecimentos + Gastos Recorrentes */}
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
                      {item.category} · {item.count} {item.count === 1 ? 'lançamento' : 'lançamentos'}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white font-mono-tabular shrink-0">
                  {formatBRL(item.amount)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Repeat className="w-4 h-4 text-violet-500" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Gastos Recorrentes & Assinaturas Detectadas
            </h2>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-[#222C38]">
            {recurringSubscriptions.map((sub) => (
              <div key={sub.name} className="py-3.5 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {sub.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {sub.category} · {sub.cadence}
                  </p>
                  {sub.alert && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      Sugestão IA: {sub.alert}
                    </p>
                  )}
                </div>
                <span className="text-sm font-bold text-slate-900 dark:text-white font-mono-tabular shrink-0">
                  {formatBRL(sub.amount)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
