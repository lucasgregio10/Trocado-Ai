import React, { useState } from 'react';
import { X, Pencil, Trash2, Check, Sparkles, PenLine } from 'lucide-react';
import { Category, Expense, PaymentMethod } from '../types/finance';
import {
  EXPENSE_SOURCE_LABELS,
  PAYMENT_METHOD_LABELS,
  centsToDecimalInput,
  formatCentsBRL,
  formatDateBR,
  parseCurrencyInputToCents,
} from '../utils/formatters';
import { SafeImage } from './TrocadoLogo';

interface ExpenseDetailModalProps {
  expense: Expense | null;
  categories: Category[];
  onClose: () => void;
  onUpdate: (updated: Expense) => void;
  onDelete: (id: string) => void;
}

export function ExpenseDetailModal({
  expense,
  categories,
  onClose,
  onUpdate,
  onDelete,
}: ExpenseDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [merchant, setMerchant] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [expenseDate, setExpenseDate] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!expense) return null;

  const isAi = expense.source !== 'manual';
  const catName =
    expense.categoryName ||
    categories.find((c) => c.id === expense.categoryId)?.name ||
    'Outros';

  const startEdit = () => {
    setMerchant(expense.merchant);
    setAmountStr(centsToDecimalInput(expense.amountCents));
    setCategoryId(expense.categoryId);
    setPaymentMethod(expense.paymentMethod);
    setExpenseDate(expense.expenseDate);
    setIsEditing(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = parseCurrencyInputToCents(amountStr);
    if (!merchant.trim() || amountCents <= 0) return;

    const chosenCat = categories.find((c) => c.id === categoryId);
    onUpdate({
      ...expense,
      merchant: merchant.trim(),
      amountCents,
      categoryId,
      categoryName: chosenCat?.name || expense.categoryName,
      categoryColor: chosenCat?.color || expense.categoryColor,
      paymentMethod,
      expenseDate,
      updatedAt: new Date().toISOString(),
    });
    setIsEditing(false);
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
          <div className="flex items-center gap-2 text-xs font-semibold">
            {isAi ? (
              <span className="inline-flex items-center gap-1.5 text-violet-600 dark:text-violet-300">
                <Sparkles className="w-3.5 h-3.5" />
                {EXPENSE_SOURCE_LABELS[expense.source]}
                {expense.aiConfidence ? ` · ${expense.aiConfidence}% precisão` : ''}
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
          {(expense.receiptUrl || expense.receiptKey) && (
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-[#222C38] bg-slate-100 dark:bg-[#0B0F14]">
              <SafeImage
                src={expense.receiptUrl}
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
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Estabelecimento
                  </label>
                  <input
                    type="text"
                    required
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Valor (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm font-mono-tabular text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Categoria
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Data
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm font-mono-tabular text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Pagamento
                  </label>
                  <select
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
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] text-sm font-medium text-slate-700 dark:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-sm"
                >
                  <Check className="w-4 h-4" />
                  Salvar Alterações
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

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                {confirmDelete ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-500 font-medium">Confirmar exclusão?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDelete(expense.id);
                        onClose();
                      }}
                      className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                    >
                      Sim, Excluir
                    </button>
                    <button
                      type="button"
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
