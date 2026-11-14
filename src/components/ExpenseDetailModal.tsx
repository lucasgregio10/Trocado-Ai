import React, { useState } from 'react';
import { X, Pencil, Trash2, Check, Sparkles, PenLine } from 'lucide-react';
import { Expense } from '../types/finance';
import { formatBRL, formatShortDate } from '../utils/formatters';
import { SafeImage } from './TrocadoLogo';
import { STITCH_IMAGES } from '../data/mockFinanceData';

interface ExpenseDetailModalProps {
  expense: Expense | null;
  categories: string[];
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
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [date, setDate] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!expense) return null;

  const isAi = expense.origin !== 'manual';

  const startEdit = () => {
    setMerchant(expense.merchant);
    setAmount(String(expense.amount));
    setCategory(expense.category);
    setPaymentMethod(expense.paymentMethod);
    setDate(expense.date);
    setIsEditing(true);
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amount.replace(',', '.'));
    if (!merchant.trim() || !Number.isFinite(num) || num <= 0) return;
    onUpdate({
      ...expense,
      merchant: merchant.trim(),
      amount: num,
      category,
      paymentMethod,
      date,
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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#222C38]">
          <div className="flex items-center gap-2 text-xs font-semibold">
            {isAi ? (
              <span className="inline-flex items-center gap-1.5 text-violet-600 dark:text-violet-300">
                <Sparkles className="w-3.5 h-3.5" />
                Registrado por IA {expense.confidence ? `· ${expense.confidence}% precisão` : ''}
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
          {/* Large Receipt Image */}
          <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-[#222C38] bg-slate-100 dark:bg-[#0B0F14]">
            <SafeImage
              src={expense.receiptImage || STITCH_IMAGES.receiptOcrPreview}
              alt={`Comprovante de ${expense.merchant}`}
              className="w-full h-56 object-cover"
              fallbackType="receipt"
            />
          </div>

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
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm font-mono-tabular text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Categoria
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
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
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm font-mono-tabular text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Pagamento
                  </label>
                  <input
                    type="text"
                    required
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white"
                  />
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
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {expense.subcategory} {expense.cnpj ? `· CNPJ ${expense.cnpj}` : ''}
                  </p>
                </div>
                <div className="sm:text-right">
                  <p className="text-2xl font-bold text-slate-900 dark:text-white font-mono-tabular">
                    {formatBRL(expense.amount)}
                  </p>
                  <p className="text-xs text-emerald-600 dark:text-[#4EDEA3] font-medium mt-0.5">
                    {expense.status}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-4 border-y border-slate-100 dark:border-[#222C38] text-xs">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Categoria</p>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {expense.category}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Data e Hora</p>
                  <p className="font-semibold text-slate-900 dark:text-white font-mono-tabular mt-0.5">
                    {formatShortDate(expense.date)} · {expense.time}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Pagamento</p>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {expense.paymentMethod}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Origem</p>
                  <p className="font-semibold text-slate-900 dark:text-white mt-0.5">
                    {isAi ? 'Registrado por IA' : 'Manual'}
                  </p>
                </div>
              </div>

              {expense.items && expense.items.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                    Itens do Comprovante
                  </h3>
                  <div className="rounded-xl border border-slate-200 dark:border-[#222C38] divide-y divide-slate-100 dark:divide-[#222C38]">
                    {expense.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="px-3.5 py-2.5 flex items-center justify-between text-xs"
                      >
                        <span className="text-slate-700 dark:text-slate-200">
                          {item.quantity} · {item.name}
                        </span>
                        <span className="font-mono-tabular font-semibold text-slate-900 dark:text-white">
                          {formatBRL(item.price)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
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
