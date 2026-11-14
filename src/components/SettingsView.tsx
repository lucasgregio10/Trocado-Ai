import React, { useState } from 'react';
import { Palette, Tag, User, Download, Plus } from 'lucide-react';
import { Category, Expense, Profile } from '../types/finance';
import { exportExpensesToCSV } from '../utils/formatters';

interface SettingsViewProps {
  profile: Profile | null;
  categories: Category[];
  expenses: Expense[];
  isDark: boolean;
  onSetTheme: (mode: 'light' | 'dark') => void;
  onUpdateDisplayName: (displayName: string) => void;
  onAddCategory: (name: string, color: string) => void;
  onDeleteCategory: (id: string) => void;
}

type SettingsTab = 'appearance' | 'categories' | 'account';

export function SettingsView({
  profile,
  categories,
  expenses,
  isDark,
  onSetTheme,
  onUpdateDisplayName,
  onAddCategory,
  onDeleteCategory,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#10B981');
  const [displayName, setDisplayName] = useState(profile?.displayName || '');

  const handleAddCat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    onAddCategory(newCatName.trim(), newCatColor);
    setNewCatName('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Configurações
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Preferências de aparência, categorias personalizadas e portabilidade de dados.
        </p>
      </div>

      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#151B23] border border-slate-200 dark:border-[#222C38] overflow-x-auto no-scrollbar">
        {[
          { id: 'appearance', label: 'Tema & Aparência', icon: Palette },
          { id: 'categories', label: 'Categorias', icon: Tag },
          { id: 'account', label: 'Perfil & Dados', icon: User },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as SettingsTab)}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-white dark:bg-[#222C38] text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'appearance' && (
        <section className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 max-w-2xl space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Tema da Interface
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Alterne entre o modo Claro e o modo Escuro.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => onSetTheme('light')}
              className={`p-4 rounded-2xl border text-left transition-colors ${
                !isDark
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-slate-200 dark:border-[#222C38] hover:bg-slate-50 dark:hover:bg-[#1C2025]'
              }`}
            >
              <div className="h-16 rounded-xl bg-[#F8FAFC] border border-slate-200 p-2.5 flex flex-col justify-between mb-3">
                <div className="h-2 w-16 rounded bg-slate-300" />
                <div className="h-3 w-24 rounded bg-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Modo Claro</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Superfícies claras com alto contraste diurno.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onSetTheme('dark')}
              className={`p-4 rounded-2xl border text-left transition-colors ${
                isDark
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-slate-200 dark:border-[#222C38] hover:bg-slate-50 dark:hover:bg-[#1C2025]'
              }`}
            >
              <div className="h-16 rounded-xl bg-[#0B0F14] border border-[#222C38] p-2.5 flex flex-col justify-between mb-3">
                <div className="h-2 w-16 rounded bg-slate-700" />
                <div className="h-3 w-24 rounded bg-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Modo Escuro</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fundo escuro para leitura confortável.
              </p>
            </button>
          </div>
        </section>
      )}

      {activeTab === 'categories' && (
        <section className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 max-w-3xl space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Gerenciar Categorias
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Crie categorias personalizadas para classificar seus gastos.
            </p>
          </div>

          <form onSubmit={handleAddCat} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Nome da nova categoria"
              className="flex-1 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
            />
            <input
              type="color"
              value={newCatColor}
              onChange={(e) => setNewCatColor(e.target.value)}
              aria-label="Cor da categoria"
              className="w-12 h-10 rounded-xl border border-slate-200 dark:border-[#222C38] bg-transparent cursor-pointer"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-sm whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </form>

          {categories.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
              Nenhuma categoria cadastrada.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#222C38] border-t border-slate-100 dark:border-[#222C38]">
              {categories.map((cat) => (
                <div key={cat.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-3.5 h-3.5 rounded-sm shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="text-sm font-medium text-slate-900 dark:text-white">
                      {cat.name}
                    </span>
                  </div>
                  {!cat.isDefault && (
                    <button
                      type="button"
                      onClick={() => onDeleteCategory(cat.id)}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                    >
                      Remover
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === 'account' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Dados da Conta
            </h2>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (displayName.trim()) {
                  onUpdateDisplayName(displayName.trim());
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Nome de Exibição
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  E-mail
                </label>
                <input
                  type="email"
                  disabled
                  value={profile?.email || ''}
                  placeholder="Conectado via Supabase Auth"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-100 dark:bg-[#101419] text-sm text-slate-500 dark:text-slate-400"
                />
              </div>
              <button
                type="submit"
                disabled={!displayName.trim()}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-[#0B0F14] font-semibold text-sm"
              >
                Salvar Perfil
              </button>
            </form>
          </section>

          <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 space-y-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Exportação de Dados
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Exporte seus lançamentos financeiros em CSV compatível com planilhas.
            </p>
            <button
              type="button"
              disabled={expenses.length === 0}
              onClick={() => exportExpensesToCSV(expenses)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] hover:bg-slate-50 dark:hover:bg-[#1C2025] disabled:opacity-50 text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              <Download className="w-4 h-4" />
              Exportar Dados ({expenses.length} despesas)
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
