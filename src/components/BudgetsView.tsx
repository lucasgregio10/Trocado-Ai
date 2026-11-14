import React, { useMemo, useState } from 'react';
import { Sparkles, Plus, AlertTriangle, CheckCircle2, PiggyBank } from 'lucide-react';
import { CategoryBudget, Expense, SavingsGoal } from '../types/finance';
import { formatBRL } from '../utils/formatters';
import { CategoryIcon } from './CategoryIcon';

interface BudgetsViewProps {
  expenses: Expense[];
  budgets: CategoryBudget[];
  goals: SavingsGoal[];
  onUpdateBudgetLimit: (id: string, newLimit: number) => void;
  onApplyAiRebalance: () => void;
  onContributeGoal: (goalId: string, amount: number) => void;
  onAddBudgetCategory: (category: string, limit: number) => void;
}

export function BudgetsView({
  expenses,
  budgets,
  goals,
  onUpdateBudgetLimit,
  onApplyAiRebalance,
  onContributeGoal,
  onAddBudgetCategory,
}: BudgetsViewProps) {
  const [filter, setFilter] = useState<'all' | 'alert' | 'healthy'>('all');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newCatName, setNewCatName] = useState('Educação');
  const [newCatLimit, setNewCatLimit] = useState('450');

  const totalSpent = useMemo(
    () => expenses.reduce((s, e) => s + e.amount, 0),
    [expenses]
  );
  const totalAllocated = useMemo(
    () => budgets.reduce((s, b) => s + b.limit, 0),
    [budgets]
  );
  const usedPct = totalAllocated > 0 ? (totalSpent / totalAllocated) * 100 : 0;
  const remainingTotal = Math.max(0, totalAllocated - totalSpent);

  const enrichedBudgets = useMemo(() => {
    return budgets.map((b) => {
      const spent = expenses
        .filter((e) => e.category === b.category)
        .reduce((s, e) => s + e.amount, 0);
      const pct = b.limit > 0 ? (spent / b.limit) * 100 : 0;
      const isAlert = pct >= 90;
      return { ...b, spent, pct, isAlert };
    });
  }, [budgets, expenses]);

  const alertCount = enrichedBudgets.filter((b) => b.isAlert).length;
  const visibleBudgets = enrichedBudgets.filter((b) => {
    if (filter === 'alert') return b.isAlert;
    if (filter === 'healthy') return !b.isAlert;
    return true;
  });

  const handleCreateBudget = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(newCatLimit);
    if (!newCatName.trim() || !Number.isFinite(num) || num <= 0) return;
    onAddBudgetCategory(newCatName.trim(), num);
    setShowNewForm(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Orçamentos Mensais & Metas
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Ajuste limites mensais por categoria com sliders em tempo real · Fechamento em 7 dias
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewForm((v) => !v)}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-sm transition-colors self-start md:self-auto whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Novo Orçamento
        </button>
      </div>

      {showNewForm && (
        <form
          onSubmit={handleCreateBudget}
          className="rounded-2xl border border-emerald-500/40 bg-white dark:bg-[#151B23] p-5 flex flex-col sm:flex-row items-end gap-4"
        >
          <div className="flex-1 w-full">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Nome da Categoria
            </label>
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div className="w-full sm:w-48">
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
              Limite Mensal (R$)
            </label>
            <input
              type="number"
              min="50"
              step="50"
              required
              value={newCatLimit}
              onChange={(e) => setNewCatLimit(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm font-mono-tabular text-slate-900 dark:text-white"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-sm whitespace-nowrap"
          >
            Adicionar Limite
          </button>
        </form>
      )}

      {/* Summary Row */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Orçamento Total Alocado</p>
              <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                <span className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white font-mono-tabular">
                  {formatBRL(totalSpent)}
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400 font-mono-tabular">
                  / {formatBRL(totalAllocated)}
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
            <span>Restam {formatBRL(remainingTotal)} até 31/10</span>
            <span>D-7 para renovação do ciclo</span>
          </div>
        </section>

        <section
          className="lg:col-span-5 rounded-2xl border border-violet-200 dark:border-violet-500/30 bg-white dark:bg-[#151B23] p-6 flex flex-col justify-between"
          style={{
            backgroundImage:
              'radial-gradient(circle at top right, rgba(139, 92, 246, 0.12), transparent 65%)',
          }}
        >
          <div>
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1.5 font-semibold text-violet-600 dark:text-violet-300">
                <Sparkles className="w-3.5 h-3.5" />
                Previsão de Fechamento por IA
              </span>
              <span className="font-mono-tabular text-slate-500 dark:text-slate-400">96% precisão</span>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 mt-3 leading-relaxed">
              Risco moderado de estouro em Alimentação (+R$ 120) compensado por folga segura em Transporte (-R$ 220). Rebalanceie limites automaticamente.
            </p>
          </div>
          <button
            type="button"
            onClick={onApplyAiRebalance}
            className="mt-4 self-start px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors"
          >
            Aplicar Reequilíbrio Automático
          </button>
        </section>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Categorias Orçamentárias ({budgets.length})
        </h2>
        <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-[#151B23] border border-slate-200 dark:border-[#222C38]">
          {[
            { id: 'all', label: `Todas (${budgets.length})` },
            { id: 'alert', label: `Em Alerta (${alertCount})` },
            { id: 'healthy', label: `Controladas (${budgets.length - alertCount})` },
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

      {/* Interactive Category Budget Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {visibleBudgets.map((b) => {
          const isDanger = b.pct > 90;
          const remaining = Math.max(0, b.limit - b.spent);
          return (
            <article
              key={b.id}
              className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5 space-y-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${b.color}20`, color: b.color }}
                  >
                    <CategoryIcon category={b.category} className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                      {b.category}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{b.description}</p>
                  </div>
                </div>

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
              </div>

              <div className="h-2.5 rounded-full bg-slate-100 dark:bg-[#1C2025] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, b.pct)}%`,
                    backgroundColor: isDanger ? '#EF4444' : b.color,
                  }}
                />
              </div>

              <div className="flex items-center justify-between text-xs font-mono-tabular">
                <span className="text-slate-700 dark:text-slate-300">
                  Gasto: <strong>{formatBRL(b.spent)}</strong>
                </span>
                <span className="text-slate-500 dark:text-slate-400">
                  Restante: {formatBRL(remaining)}
                </span>
              </div>

              {/* Interactive Slider + Numeric Input */}
              <div className="pt-3 border-t border-slate-100 dark:border-[#222C38] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <label
                    htmlFor={`slider-${b.id}`}
                    className="text-slate-500 dark:text-slate-400 font-medium"
                  >
                    Definir limite mensal
                  </label>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">R$</span>
                    <input
                      type="number"
                      min={100}
                      max={5000}
                      step={50}
                      value={b.limit}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (Number.isFinite(val) && val >= 50) {
                          onUpdateBudgetLimit(b.id, val);
                        }
                      }}
                      aria-label={`Valor limite de ${b.category}`}
                      className="w-24 px-2 py-1 rounded-lg border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-xs font-mono-tabular font-semibold text-right text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
                <input
                  id={`slider-${b.id}`}
                  type="range"
                  min={100}
                  max={3000}
                  step={50}
                  value={Math.min(3000, b.limit)}
                  onChange={(e) => onUpdateBudgetLimit(b.id, Number(e.target.value))}
                  className="w-full accent-emerald-500 cursor-pointer"
                />
              </div>
            </article>
          );
        })}
      </div>

      {/* Savings Goals */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center gap-2">
          <PiggyBank className="w-5 h-5 text-emerald-500" />
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">
            Metas de Poupança & Reservas
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {goals.map((g) => {
            const pct = Math.min(100, Math.round((g.current / g.target) * 100));
            return (
              <div
                key={g.id}
                className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5 flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>Meta · {g.deadline}</span>
                    <span className="font-mono-tabular font-semibold text-slate-900 dark:text-white">
                      {pct}%
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white mt-1.5">
                    {g.title}
                  </h3>
                  <p className="text-lg font-bold text-slate-900 dark:text-white font-mono-tabular mt-2">
                    {formatBRL(g.current)}
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                      {' '}
                      / {formatBRL(g.target)}
                    </span>
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-[#1C2025] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%`, backgroundColor: g.color }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => onContributeGoal(g.id, 250)}
                    className="w-full py-2 rounded-xl border border-slate-200 dark:border-[#222C38] hover:bg-slate-50 dark:hover:bg-[#1C2025] text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors"
                  >
                    + Aportar R$ 250,00
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
