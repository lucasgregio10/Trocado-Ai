import React, { useState } from 'react';
import {
  Building2,
  RefreshCw,
  ShieldCheck,
  Palette,
  Tag,
  User,
  Download,
  Trash2,
  Plus,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { BankConnection, CustomCategory, Expense } from '../types/finance';
import { STITCH_IMAGES } from '../data/mockFinanceData';
import { exportExpensesToCSV } from '../utils/formatters';
import { SafeImage } from './TrocadoLogo';

interface SettingsViewProps {
  connections: BankConnection[];
  customCategories: CustomCategory[];
  expenses: Expense[];
  isDark: boolean;
  onSetTheme: (mode: 'light' | 'dark') => void;
  onToggleAutoSync: (id: string) => void;
  onRevalidateBank: (id: string) => void;
  onSyncAll: () => void;
  onAddCategory: (name: string, color: string) => void;
  onDeleteCategory: (id: string) => void;
  onNotify: (msg: string) => void;
}

type SettingsTab = 'openfinance' | 'appearance' | 'categories' | 'account';

export function SettingsView({
  connections,
  customCategories,
  expenses,
  isDark,
  onSetTheme,
  onToggleAutoSync,
  onRevalidateBank,
  onSyncAll,
  onAddCategory,
  onDeleteCategory,
  onNotify,
}: SettingsViewProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>('openfinance');
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#10B981');
  const [userName, setUserName] = useState('Lucas Silva');
  const [userEmail, setUserEmail] = useState('lucas.silva@email.com');
  const [confirmDeleteAccount, setConfirmDeleteAccount] = useState(false);

  const handleAddCat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    onAddCategory(newCatName.trim(), newCatColor);
    setNewCatName('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Configurações & Conexões Open Finance
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Gerencie instituições integradas via Open Finance Brasil, tema, categorias e dados da conta.
          </p>
        </div>

        {activeTab === 'openfinance' && (
          <button
            type="button"
            onClick={onSyncAll}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-sm transition-colors self-start md:self-auto whitespace-nowrap"
          >
            <RefreshCw className="w-4 h-4" />
            Sincronizar Todas
          </button>
        )}
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#151B23] border border-slate-200 dark:border-[#222C38] overflow-x-auto no-scrollbar">
        {[
          { id: 'openfinance', label: 'Open Finance & Bancos', icon: Building2 },
          { id: 'appearance', label: 'Tema & Aparência', icon: Palette },
          { id: 'categories', label: 'Categorias Personalizadas', icon: Tag },
          { id: 'account', label: 'Perfil & Segurança', icon: User },
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

      {/* Tab 1: Open Finance */}
      {activeTab === 'openfinance' && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Protocolo Bacen FAPI / OAuth 2.0
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Acesso somente leitura regulado pelo Banco Central do Brasil.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-4 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  {connections.filter((c) => c.status === 'connected').length} de {connections.length} Conexões Ativas
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Conciliação contínua de extratos e faturas.
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-4 flex items-start gap-3">
              <RefreshCw className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                  Categorização Automática IA
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Lançamentos importados são classificados em segundos.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {connections.map((bank) => {
              const needsReauth = bank.status === 'reauth_required';
              return (
                <article
                  key={bank.id}
                  className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-5 flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-sm text-white shrink-0"
                          style={{ backgroundColor: bank.accentColor }}
                        >
                          {bank.shortCode}
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                            {bank.bankName}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            {bank.legalName} · {bank.lastSyncLabel}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 text-xs font-semibold ${
                          needsReauth ? 'text-amber-500' : 'text-emerald-600 dark:text-[#4EDEA3]'
                        }`}
                      >
                        {needsReauth ? (
                          <AlertTriangle className="w-3.5 h-3.5" />
                        ) : (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        )}
                        {needsReauth ? 'Revalidar Token' : 'Sincronizado'}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100 dark:divide-[#222C38] border-y border-slate-100 dark:border-[#222C38]">
                      {bank.accounts.map((acc) => (
                        <div
                          key={acc.title}
                          className="py-2.5 flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800 dark:text-slate-200 truncate">
                              {acc.title}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400 truncate">
                              {acc.subtitle}
                            </p>
                          </div>
                          <span className="font-mono-tabular font-semibold text-slate-900 dark:text-white shrink-0">
                            {acc.balanceOrStatus}
                          </span>
                        </div>
                      ))}
                    </div>

                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Escopos: {bank.scopes.join(' · ')} · Consentimento até {bank.consentUntil}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-1">
                    {needsReauth ? (
                      <button
                        type="button"
                        onClick={() => onRevalidateBank(bank.id)}
                        className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-[#0B0F14] font-semibold text-xs transition-colors"
                      >
                        Revalidar Conexão no App {bank.bankName}
                      </button>
                    ) : (
                      <>
                        <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={bank.autoSync}
                            onChange={() => onToggleAutoSync(bank.id)}
                            className="rounded accent-emerald-500"
                          />
                          Auto-sincronizar
                        </label>
                        <button
                          type="button"
                          onClick={() => onNotify(`Extrato ${bank.bankName} atualizado agora.`)}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#222C38] hover:bg-slate-50 dark:hover:bg-[#1C2025] text-xs font-medium text-slate-700 dark:text-slate-200"
                        >
                          Atualizar Agora
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 2: Theme & Appearance */}
      {activeTab === 'appearance' && (
        <section className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 max-w-2xl space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Tema da Interface
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Alterne entre o modo Claro editorial e o modo Escuro de alto contraste.
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
                Obsidian slate para leitura confortável em qualquer ambiente.
              </p>
            </button>
          </div>
        </section>
      )}

      {/* Tab 3: Custom Categories */}
      {activeTab === 'categories' && (
        <section className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 max-w-3xl space-y-6">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Gerenciar Categorias
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Crie categorias personalizadas usadas pelo scanner OCR e pelos orçamentos.
            </p>
          </div>

          <form onSubmit={handleAddCat} className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="Nome da nova categoria (ex: Pets, Investimentos)"
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

          <div className="divide-y divide-slate-100 dark:divide-[#222C38] border-t border-slate-100 dark:border-[#222C38]">
            {customCategories.map((cat) => (
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
                <button
                  type="button"
                  onClick={() => onDeleteCategory(cat.id)}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tab 4: Profile & Security */}
      {activeTab === 'account' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 space-y-5">
            <div className="flex items-center gap-4">
              <SafeImage
                src={STITCH_IMAGES.userPortrait}
                alt="Lucas Silva"
                className="w-16 h-16 rounded-2xl object-cover border border-slate-200 dark:border-[#222C38]"
                fallbackType="avatar"
              />
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  {userName}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Plano Pro · Membro desde Jan 2024
                </p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                onNotify('Dados da conta atualizados com sucesso!');
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Nome Completo
                </label>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  E-mail Principal
                </label>
                <input
                  type="email"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-sm"
              >
                Salvar Perfil
              </button>
            </form>
          </section>

          <section className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 space-y-5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Portabilidade & Privacidade
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Exporte todos os seus lançamentos financeiros em CSV compatível com Excel ou solicite a exclusão definitiva dos dados.
            </p>

            <button
              type="button"
              onClick={() => exportExpensesToCSV(expenses, 'trocado-backup-completo.csv')}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] hover:bg-slate-50 dark:hover:bg-[#1C2025] text-sm font-medium text-slate-800 dark:text-slate-200"
            >
              <Download className="w-4 h-4" />
              Exportar Dados ({expenses.length} despesas)
            </button>

            <div className="pt-4 border-t border-slate-100 dark:border-[#222C38]">
              {confirmDeleteAccount ? (
                <div className="space-y-2.5">
                  <p className="text-xs text-red-500 font-medium">
                    Esta ação revoga os tokens Open Finance e apaga seu histórico local.
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setConfirmDeleteAccount(false);
                        onNotify('Solicitação de exclusão registrada.');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold"
                    >
                      Confirmar Exclusão
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteAccount(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#222C38] text-xs"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteAccount(true)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600 dark:text-red-400 hover:underline"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir Conta
                </button>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
