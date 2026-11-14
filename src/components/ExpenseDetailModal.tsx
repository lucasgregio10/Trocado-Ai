import React, { useEffect, useState } from 'react';
import { X, Pencil, Trash2, Check, Sparkles, PenLine, Loader2, AlertCircle } from 'lucide-react';
import { Category, Expense, ExpenseDraftInput, PaymentMethod } from '../types/finance';
import {
  EXPENSE_SOURCE_LABELS,
  PAYMENT_METHOD_LABELS,
  formatCentsBRL,
  formatCentsInputMask,
  formatDateBR,
  getMaxExpenseDateISO,
  parseDigitsToCents,
} from '../utils/formatters';
import { SafeImage } from './TrocadoLogo';
import { CategoryIcon } from './CategoryIcon';
import { apiFetchBlob } from '../lib/api';

interface ExpenseDetailModalProps {
  expense: Expense | null;
  initialEditMode?: boolean;
  receiptsEnabled?: boolean;
  categories: Category[];
  isSaving?: boolean;
  isDeleting?: boolean;
  onClose: () => void;
  onUpdate: (id: string, payload: Partial<ExpenseDraftInput>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

export function ExpenseDetailModal({
  expense,
  initialEditMode = false,
  receiptsEnabled = false,
  categories,
  isSaving = false,
  isDeleting = false,
  onClose,
  onUpdate,
  onDelete,
}: ExpenseDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [amountCents, setAmountCents] = useState(0);
  const [categoryId, setCategoryId] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [expenseDate, setExpenseDate] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [receiptObjectUrl, setReceiptObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!expense || !expense.receiptKey || !receiptsEnabled) {
      setReceiptObjectUrl(null);
      return;
    }

    let cancelled = false;
    let createdUrl: string | null = null;

    apiFetchBlob(`/api/expenses/${expense.id}/receipt`)
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setReceiptObjectUrl(createdUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setReceiptObjectUrl(null);
        }
      });

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [expense, receiptsEnabled]);

  useEffect(() => {
    if (!expense) {
      setIsEditing(false);
      setConfirmDelete(false);
      setFormError(null);
      return;
    }
    setMerchant(expense.merchant);
    setAmountCents(expense.amountCents);
    setCategoryId(expense.categoryId);
    setSubcategory(expense.subcategory || '');
    setDescription(expense.description || '');
    setPaymentMethod(expense.paymentMethod);
    setExpenseDate(expense.expenseDate);
    setIsEditing(initialEditMode);
    setConfirmDelete(false);
    setFormError(null);
  }, [expense, initialEditMode]);

  if (!expense) return null;

  const isAi = expense.source !== 'manual';
  const catObj = categories.find((c) => c.id === expense.categoryId);
  const catName = expense.categoryName || catObj?.name || 'Outros';

  const startEdit = () => {
    setMerchant(expense.merchant);
    setAmountCents(expense.amountCents);
    setCategoryId(expense.categoryId);
    setSubcategory(expense.subcategory || '');
    setDescription(expense.description || '');
    setPaymentMethod(expense.paymentMethod);
    setExpenseDate(expense.expenseDate);
    setFormError(null);
    setIsEditing(true);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!merchant.trim()) {
      setFormError('Informe o estabelecimento.');
      return;
    }
    if (amountCents <= 0) {
      setFormError('Informe um valor maior que zero.');
      return;
    }

    try {
      await onUpdate(expense.id, {
        merchant: merchant.trim(),
        amountCents,
        categoryId,
        subcategory: subcategory.trim() || null,
        description: description.trim() || null,
        paymentMethod,
        expenseDate,
      });
      setIsEditing(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível salvar as alterações.');
    }
  };

  const handleConfirmDelete = async () => {
    setFormError(null);
    try {
      await onDelete(expense.id);
      onClose();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível excluir a despesa.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="expense-detail-title"
    >
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#222C38]">
          <div className="flex items-center gap-2 text-xs font-semibold flex-wrap">
            {isAi ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300">
                <Sparkles className="w-3.5 h-3.5" />
                Registrado por IA
                <span className="font-normal opacity-80">
                  · {EXPENSE_SOURCE_LABELS[expense.source]}
                  {expense.aiConfidence ? ` · ${expense.aiConfidence}% precisão` : ''}
                </span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <PenLine className="w-3.5 h-3.5" />
                Manual
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C2025] transition-colors"
            aria-label="Fechar detalhe"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {formError && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-600 dark:text-red-300"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{formError}</span>
            </div>
          )}

          {(receiptObjectUrl || expense.receiptUrl || expense.receiptKey) && (
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-[#222C38] bg-slate-100 dark:bg-[#0B0F14]">
              <SafeImage
                src={receiptObjectUrl || expense.receiptUrl}
                alt={`Comprovante de ${expense.merchant}`}
                className="w-full h-56 object-cover"
                fallbackType="receipt"
              />
            </div>
          )}

          {isEditing ? (
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="detail-merchant"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                  >
                    Estabelecimento
                  </label>
                  <input
                    id="detail-merchant"
                    type="text"
                    required
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="detail-amount"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                  >
                    Valor (R$)
                  </label>
                  <input
                    id="detail-amount"
                    type="text"
                    inputMode="numeric"
                    required
                    value={formatCentsInputMask(amountCents)}
                    onChange={(e) => setAmountCents(parseDigitsToCents(e.target.value))}
                    placeholder="R$ 0,00"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm font-mono-tabular font-semibold text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label
                    htmlFor="detail-date"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                  >
                    Data
                  </label>
                  <input
                    id="detail-date"
                    type="date"
                    required
                    max={getMaxExpenseDateISO()}
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm font-mono-tabular text-slate-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <span
                    id="detail-category-label"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
                  >
                    Categoria
                  </span>
                  <div
                    role="group"
                    aria-labelledby="detail-category-label"
                    className="flex flex-wrap gap-2"
                  >
                    {categories.map((cat) => {
                      const active = categoryId === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setCategoryId(cat.id)}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                            active
                              ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-[#4EDEA3]'
                              : 'border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          <CategoryIcon category={cat.name} icon={cat.icon} className="w-3.5 h-3.5" />
                          <span>{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="detail-payment"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                  >
                    Pagamento
                  </label>
                  <select
                    id="detail-payment"
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
                  >
                    {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                      <option key={method} value={method}>
                        {PAYMENT_METHOD_LABELS[method]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="detail-subcategory"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                  >
                    Subcategoria (opcional)
                  </label>
                  <input
                    id="detail-subcategory"
                    type="text"
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    placeholder="Ex: Supermercado"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label
                    htmlFor="detail-description"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1"
                  >
                    Observação (opcional)
                  </label>
                  <input
                    id="detail-description"
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Observações sobre esta despesa"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-[#0B0F14] font-semibold text-sm"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                <div>
                  <h2
                    id="expense-detail-title"
                    className="text-xl font-bold text-slate-900 dark:text-white"
                  >
                    {expense.merchant}
                  </h2>
                  {(expense.subcategory || expense.description) && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {[expense.subcategory, expense.description].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
                <div className="sm:text-right">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono-tabular">
                    {formatCentsBRL(expense.amountCents)}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-slate-100 dark:border-[#222C38] text-xs">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Categoria</p>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">{catName}</p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Data</p>
                  <p className="font-semibold text-slate-900 dark:text-white font-mono-tabular mt-0.5">
                    {formatDateBR(expense.expenseDate)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Pagamento</p>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {PAYMENT_METHOD_LABELS[expense.paymentMethod]}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Origem</p>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {EXPENSE_SOURCE_LABELS[expense.source]}
                  </p>
                </div>
              </div>

              {expense.description && (
                <div className="rounded-xl bg-slate-50 dark:bg-[#0B0F14] border border-slate-200 dark:border-[#222C38] p-3.5 text-xs">
                  <p className="text-slate-500 dark:text-slate-400 mb-1">Observação</p>
                  <p className="text-slate-800 dark:text-slate-200">{expense.description}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-500 font-medium">Confirmar exclusão?</span>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={handleConfirmDelete}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-semibold"
                    >
                      {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      Sim, Excluir
                    </button>
                    <button
                      type="button"
                      disabled={isDeleting}
                      onClick={() => setConfirmDelete(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#222C38] text-xs font-medium"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 dark:border-red-500/30 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 text-xs font-semibold transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                    Excluir
                  </button>
                )}

                <button
                  type="button"
                  onClick={startEdit}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-[#0B0F14] hover:opacity-90 text-xs font-semibold transition-opacity"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar Despesa
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
