import React, { useEffect, useState } from 'react';
import {
  Palette,
  Tag,
  User,
  Download,
  Plus,
  LogOut,
  Monitor,
  Pencil,
  Trash2,
  Check,
  X,
  Lock,
  Eye,
  EyeOff,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Category, Profile, ThemePreference } from '../types/finance';
import { downloadAuthenticatedCsv } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { evaluatePassword, PasswordStrengthMeter } from './auth/PasswordStrengthMeter';

interface SettingsViewProps {
  profile: Profile | null;
  categories: Category[];
  themePreference: ThemePreference;
  isSavingProfile?: boolean;
  isSavingCategory?: boolean;
  isDeletingAccount?: boolean;
  onSetTheme: (mode: ThemePreference) => void;
  onUpdateDisplayName: (displayName: string) => void;
  onAddCategory: (name: string, color: string) => Promise<void>;
  onUpdateCategory: (id: string, payload: { name: string; color: string }) => Promise<void>;
  onDeleteCategory: (id: string, moveToCategoryId?: string) => Promise<void>;
  onDeleteAccount: (confirmation: string) => Promise<void>;
  onSignOut: () => void;
  onNotify?: (toast: { type: 'success' | 'error'; message: string }) => void;
}

type SettingsTab = 'appearance' | 'categories' | 'account';

export function SettingsView({
  profile,
  categories,
  themePreference,
  isSavingProfile = false,
  isSavingCategory = false,
  isDeletingAccount = false,
  onSetTheme,
  onUpdateDisplayName,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onDeleteAccount,
  onSignOut,
  onNotify,
}: SettingsViewProps) {
  const { updatePassword } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>('appearance');

  // Category creation & editing
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState('#10B981');
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [editCatColor, setEditCatColor] = useState('#10B981');

  // Category deletion / move modal
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [moveToCategoryId, setMoveToCategoryId] = useState<string>('');

  // Profile & password & export & LGPD delete
  const [displayName, setDisplayName] = useState(profile?.displayName || '');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deleteAccountText, setDeleteAccountText] = useState('');

  useEffect(() => {
    if (profile?.displayName !== undefined) {
      setDisplayName(profile.displayName);
    }
  }, [profile?.displayName]);

  const handleAddCat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || isSavingCategory) return;
    try {
      await onAddCategory(newCatName.trim(), newCatColor);
      setNewCatName('');
    } catch {
      // Notification handled by parent mutation
    }
  };

  const startEditingCategory = (cat: Category) => {
    setEditingCatId(cat.id);
    setEditCatName(cat.name);
    setEditCatColor(cat.color);
  };

  const handleSaveEditCategory = async (id: string) => {
    if (!editCatName.trim() || isSavingCategory) return;
    try {
      await onUpdateCategory(id, {
        name: editCatName.trim(),
        color: editCatColor,
      });
      setEditingCatId(null);
    } catch {
      // Notification handled by parent mutation
    }
  };

  const requestDeleteCategory = (cat: Category) => {
    const others = categories.filter((c) => c.id !== cat.id);
    if ((cat.expenseCount ?? 0) > 0) {
      setDeletingCategory(cat);
      setMoveToCategoryId(others[0]?.id || '');
      return;
    }
    setDeletingCategory(cat);
    setMoveToCategoryId('');
  };

  const confirmDeleteCategory = async () => {
    if (!deletingCategory || isSavingCategory) return;
    const needsMove = (deletingCategory.expenseCount ?? 0) > 0;
    if (needsMove && !moveToCategoryId) return;

    try {
      await onDeleteCategory(deletingCategory.id, needsMove ? moveToCategoryId : undefined);
      setDeletingCategory(null);
      setMoveToCategoryId('');
    } catch {
      // Notification handled by parent mutation
    }
  };

  const passwordStatus = evaluatePassword(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordStatus.isValid) {
      onNotify?.({
        type: 'error',
        message: 'A senha deve ter ao menos 8 caracteres, com letras e números.',
      });
      return;
    }
    if (!passwordsMatch) {
      onNotify?.({ type: 'error', message: 'As senhas não coincidem.' });
      return;
    }

    setIsUpdatingPassword(true);
    try {
      await updatePassword(newPassword);
      setNewPassword('');
      setConfirmPassword('');
      onNotify?.({ type: 'success', message: 'Senha alterada com sucesso!' });
    } catch (err) {
      onNotify?.({
        type: 'error',
        message: err instanceof Error ? err.message : 'Não foi possível alterar a senha.',
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleExportAllCsv = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      await downloadAuthenticatedCsv();
      onNotify?.({ type: 'success', message: 'Dados exportados em CSV!' });
    } catch (err) {
      onNotify?.({
        type: 'error',
        message: err instanceof Error ? err.message : 'Não foi possível exportar os dados.',
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
          Configurações
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Preferências de aparência, categorias personalizadas, segurança e exportação.
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
        <section className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 max-w-3xl space-y-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Tema da Interface
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Escolha entre modo Claro, Escuro ou seguir automaticamente o sistema. Sua preferência fica salva no seu perfil.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => onSetTheme('light')}
              className={`p-4 rounded-2xl border text-left transition-colors ${
                themePreference === 'light'
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-slate-200 dark:border-[#222C38] hover:bg-slate-50 dark:hover:bg-[#1C2025]'
              }`}
            >
              <div className="h-16 rounded-xl bg-[#F8FAFC] border border-slate-200 p-2.5 flex flex-col justify-between mb-3">
                <div className="h-2 w-16 rounded bg-slate-300" />
                <div className="h-3 w-20 rounded bg-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Modo Claro</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Superfícies claras com alto contraste diurno.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onSetTheme('dark')}
              className={`p-4 rounded-2xl border text-left transition-colors ${
                themePreference === 'dark'
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-slate-200 dark:border-[#222C38] hover:bg-slate-50 dark:hover:bg-[#1C2025]'
              }`}
            >
              <div className="h-16 rounded-xl bg-[#0B0F14] border border-[#222C38] p-2.5 flex flex-col justify-between mb-3">
                <div className="h-2 w-16 rounded bg-slate-700" />
                <div className="h-3 w-20 rounded bg-emerald-500" />
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Modo Escuro</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Fundo escuro para leitura confortável.
              </p>
            </button>

            <button
              type="button"
              onClick={() => onSetTheme('system')}
              className={`p-4 rounded-2xl border text-left transition-colors ${
                themePreference === 'system'
                  ? 'border-emerald-500 bg-emerald-500/5'
                  : 'border-slate-200 dark:border-[#222C38] hover:bg-slate-50 dark:hover:bg-[#1C2025]'
              }`}
            >
              <div className="h-16 rounded-xl overflow-hidden border border-slate-200 dark:border-[#222C38] flex mb-3">
                <div className="w-1/2 bg-[#F8FAFC] p-2 flex flex-col justify-between">
                  <div className="h-2 w-8 rounded bg-slate-300" />
                  <div className="h-2.5 w-10 rounded bg-emerald-500" />
                </div>
                <div className="w-1/2 bg-[#0B0F14] p-2 flex flex-col justify-between items-end">
                  <Monitor className="w-3.5 h-3.5 text-slate-400" />
                  <div className="h-2.5 w-10 rounded bg-emerald-500" />
                </div>
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Sistema</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Acompanha a aparência do dispositivo.
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
              Crie novas categorias ou renomeie categorias existentes. Categorias padrão podem ser renomeadas, mas não apagadas.
            </p>
          </div>

          <form onSubmit={handleAddCat} className="flex flex-col sm:flex-row gap-3">
            <label htmlFor="new-category-name" className="sr-only">
              Nome da nova categoria
            </label>
            <input
              id="new-category-name"
              type="text"
              required
              maxLength={40}
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
              disabled={isSavingCategory || !newCatName.trim()}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-[#0B0F14] font-semibold text-sm whitespace-nowrap"
            >
              {isSavingCategory ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Adicionar
            </button>
          </form>

          {deletingCategory && (
            <div
              role="alertdialog"
              aria-labelledby="delete-cat-title"
              className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p id="delete-cat-title" className="text-sm font-semibold text-slate-900 dark:text-white">
                    Excluir categoria "{deletingCategory.name}"
                  </p>
                  {(deletingCategory.expenseCount ?? 0) > 0 ? (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Esta categoria possui{' '}
                      <strong>
                        {deletingCategory.expenseCount}{' '}
                        {deletingCategory.expenseCount === 1 ? 'despesa' : 'despesas'}
                      </strong>
                      . Escolha para qual categoria deseja mover essas despesas antes de apagar:
                    </p>
                  ) : (
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Tem certeza que deseja apagar esta categoria?
                    </p>
                  )}
                </div>
              </div>

              {(deletingCategory.expenseCount ?? 0) > 0 && (
                <select
                  value={moveToCategoryId}
                  onChange={(e) => setMoveToCategoryId(e.target.value)}
                  aria-label="Categoria de destino para as despesas"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
                >
                  {categories
                    .filter((c) => c.id !== deletingCategory.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              )}

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={isSavingCategory}
                  onClick={() => {
                    setDeletingCategory(null);
                    setMoveToCategoryId('');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] text-xs font-medium text-slate-700 dark:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={
                    isSavingCategory ||
                    ((deletingCategory.expenseCount ?? 0) > 0 && !moveToCategoryId)
                  }
                  onClick={confirmDeleteCategory}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {(deletingCategory.expenseCount ?? 0) > 0 ? 'Mover e apagar' : 'Confirmar exclusão'}
                </button>
              </div>
            </div>
          )}

          {categories.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4">
              Nenhuma categoria cadastrada.
            </p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-[#222C38] border-t border-slate-100 dark:border-[#222C38]">
              {categories.map((cat) => {
                const isEditing = editingCatId === cat.id;
                const count = cat.expenseCount ?? 0;

                return (
                  <div key={cat.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                    {isEditing ? (
                      <div className="flex-1 flex flex-wrap items-center gap-2">
                        <input
                          type="color"
                          value={editCatColor}
                          onChange={(e) => setEditCatColor(e.target.value)}
                          aria-label="Editar cor da categoria"
                          className="w-9 h-9 rounded-lg border border-slate-200 dark:border-[#222C38] bg-transparent cursor-pointer shrink-0"
                        />
                        <input
                          type="text"
                          maxLength={40}
                          value={editCatName}
                          onChange={(e) => setEditCatName(e.target.value)}
                          aria-label="Editar nome da categoria"
                          className="flex-1 min-w-[160px] px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
                        />
                        <button
                          type="button"
                          disabled={isSavingCategory || !editCatName.trim()}
                          onClick={() => handleSaveEditCategory(cat.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] text-xs font-semibold"
                        >
                          <Check className="w-3.5 h-3.5" />
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingCatId(null)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#222C38] text-xs text-slate-600 dark:text-slate-300"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-3 min-w-0">
                          <span
                            className="w-3.5 h-3.5 rounded-sm shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                {cat.name}
                              </span>
                              {cat.isDefault && (
                                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                  · Padrão
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular">
                              {count} {count === 1 ? 'despesa' : 'despesas'}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => startEditingCategory(cat)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1C2025] transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Renomear
                          </button>
                          {!cat.isDefault && (
                            <button
                              type="button"
                              onClick={() => requestDeleteCategory(cat)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Remover
                            </button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {activeTab === 'account' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
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
                <label
                  htmlFor="settings-display-name"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  Nome de Exibição
                </label>
                <input
                  id="settings-display-name"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Seu nome"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="settings-email"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                >
                  E-mail
                </label>
                <input
                  id="settings-email"
                  type="email"
                  disabled
                  value={profile?.email || ''}
                  placeholder="Conectado via Supabase Auth"
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-100 dark:bg-[#101419] text-sm text-slate-600 dark:text-slate-400"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <button
                  type="submit"
                  disabled={!displayName.trim() || isSavingProfile}
                  className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-[#0B0F14] font-semibold text-sm"
                >
                  {isSavingProfile ? 'Salvando...' : 'Salvar Perfil'}
                </button>

                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-sm font-medium transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </div>
            </form>

            <div className="pt-5 border-t border-slate-100 dark:border-[#222C38] space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                  Alterar Senha
                </h3>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <label
                    htmlFor="settings-new-password"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                  >
                    Nova senha
                  </label>
                  <div className="relative">
                    <input
                      id="settings-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres (letras e números)"
                      className="w-full px-3.5 py-2 pr-10 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                      aria-label={showNewPassword ? 'Ocultar senha' : 'Mostrar senha'}
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordStrengthMeter password={newPassword} />
                </div>

                <div>
                  <label
                    htmlFor="settings-confirm-password"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                  >
                    Confirmar nova senha
                  </label>
                  <input
                    id="settings-confirm-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
                  />
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-[11px] text-red-600 dark:text-red-400 mt-1">
                      As senhas não coincidem.
                    </p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={!passwordStatus.isValid || !passwordsMatch || isUpdatingPassword}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] hover:bg-slate-50 dark:hover:bg-[#1C2025] disabled:opacity-45 text-sm font-semibold text-slate-900 dark:text-white transition-colors"
                >
                  {isUpdatingPassword ? 'Atualizando senha...' : 'Atualizar Senha'}
                </button>
              </form>
            </div>
          </section>

          <div className="lg:col-span-5 space-y-6">
            <section className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-6 space-y-4">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Exportação de Dados
              </h2>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                Baixe todas as suas despesas em formato CSV com codificação UTF-8 BOM e separador ponto e vírgula, pronto para abrir no Excel.
              </p>
              <button
                type="button"
                disabled={isExporting}
                onClick={handleExportAllCsv}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] hover:bg-slate-50 dark:hover:bg-[#1C2025] disabled:opacity-50 text-sm font-medium text-slate-800 dark:text-slate-200"
              >
                {isExporting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isExporting ? 'Exportando CSV...' : 'Exportar Todas as Despesas (CSV)'}
              </button>
            </section>

            <section className="rounded-2xl border border-red-500/30 bg-white dark:bg-[#151B23] p-6 space-y-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                    Exclusão de Conta (LGPD)
                  </h2>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mt-1">
                    Apague permanentemente sua conta, despesas, comprovantes, orçamentos e categorias. Esta ação não pode ser desfeita.
                  </p>
                </div>
              </div>

              {!showDeleteAccountConfirm ? (
                <button
                  type="button"
                  onClick={() => {
                    setDeleteAccountText('');
                    setShowDeleteAccountConfirm(true);
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/40 bg-red-500/10 hover:bg-red-500/20 text-sm font-semibold text-red-700 dark:text-red-300 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Excluir minha conta
                </button>
              ) : (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    if (deleteAccountText.trim() !== 'EXCLUIR' || isDeletingAccount) return;
                    await onDeleteAccount(deleteAccountText.trim());
                  }}
                  className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 space-y-3"
                >
                  <div>
                    <label
                      htmlFor="delete-account-confirm"
                      className="block text-xs font-medium text-red-700 dark:text-red-300 mb-1.5"
                    >
                      Digite <strong>EXCLUIR</strong> em letras maiúsculas para confirmar:
                    </label>
                    <input
                      id="delete-account-confirm"
                      type="text"
                      value={deleteAccountText}
                      onChange={(e) => setDeleteAccountText(e.target.value)}
                      placeholder="EXCLUIR"
                      autoComplete="off"
                      className="w-full px-3.5 py-2 rounded-xl border border-red-500/40 bg-white dark:bg-[#0B0F14] text-sm font-mono-tabular text-slate-900 dark:text-white"
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <button
                      type="button"
                      disabled={isDeletingAccount}
                      onClick={() => {
                        setShowDeleteAccountConfirm(false);
                        setDeleteAccountText('');
                      }}
                      className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] text-xs font-medium text-slate-700 dark:text-slate-200"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={deleteAccountText.trim() !== 'EXCLUIR' || isDeletingAccount}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold transition-colors"
                    >
                      {isDeletingAccount ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                      {isDeletingAccount ? 'Excluindo conta...' : 'Confirmar exclusão definitiva'}
                    </button>
                  </div>
                </form>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
