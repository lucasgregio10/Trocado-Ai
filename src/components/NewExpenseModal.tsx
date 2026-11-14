import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Upload,
  MessageSquareText,
  Mic,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { Category, Expense, ExpenseSource, PaymentMethod } from '../types/finance';
import {
  PAYMENT_METHOD_LABELS,
  getTodaySaoPauloISO,
  parseCurrencyInputToCents,
} from '../utils/formatters';
import { SafeImage } from './TrocadoLogo';
import { apiFetch } from '../lib/api';

interface NewExpenseModalProps {
  isOpen: boolean;
  initialMode?: 'foto' | 'texto' | 'manual';
  categories: Category[];
  onClose: () => void;
  onSaveExpense: (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

type ModalStep = 'choose' | 'scanning' | 'error' | 'review';

export function NewExpenseModal({
  isOpen,
  initialMode = 'foto',
  categories,
  onClose,
  onSaveExpense,
}: NewExpenseModalProps) {
  const [step, setStep] = useState<ModalStep>(initialMode === 'manual' ? 'review' : 'choose');
  const [freeText, setFreeText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [previewImage, setPreviewImage] = useState<string>('');
  const [source, setSource] = useState<ExpenseSource>('manual');
  const [aiConfidence, setAiConfidence] = useState<number | null>(null);

  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [expenseDate, setExpenseDate] = useState(getTodaySaoPauloISO());
  const [categoryId, setCategoryId] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMerchant('');
    setDescription('');
    setAmountStr('');
    setExpenseDate(getTodaySaoPauloISO());
    setCategoryId(categories[0]?.id || '');
    setSubcategory('');
    setPaymentMethod('pix');
    setPreviewImage('');
    setAiConfidence(null);
    setFreeText('');
    setErrorMessage('');

    if (initialMode === 'manual') {
      setSource('manual');
      setStep('review');
    } else {
      setSource(initialMode);
      setStep('choose');
    }
  }, [isOpen, initialMode, categories]);

  if (!isOpen) return null;

  const analyzeViaApi = async (payload: {
    text?: string;
    imageBase64?: string;
    mimeType?: string;
    nextSource: ExpenseSource;
    imgPreview?: string;
  }) => {
    setSource(payload.nextSource);
    setPreviewImage(payload.imgPreview || '');
    setStep('scanning');
    setErrorMessage('');

    try {
      const data = await apiFetch<{
        merchant?: string;
        description?: string;
        amountCents?: number;
        expenseDate?: string;
        categoryId?: string;
        subcategory?: string;
        paymentMethod?: PaymentMethod;
        aiConfidence?: number;
      }>('/api/ai/parse-expense', {
        method: 'POST',
        body: JSON.stringify({
          source: payload.nextSource,
          text: payload.text,
          imageBase64: payload.imageBase64,
          mimeType: payload.mimeType,
        }),
      });

      setMerchant(data.merchant || '');
      setDescription(data.description || '');
      setAmountStr(data.amountCents ? (data.amountCents / 100).toFixed(2) : '');
      setExpenseDate(data.expenseDate || getTodaySaoPauloISO());
      setCategoryId(data.categoryId || categories[0]?.id || '');
      setSubcategory(data.subcategory || '');
      setPaymentMethod(data.paymentMethod || 'pix');
      setAiConfidence(typeof data.aiConfidence === 'number' ? data.aiConfidence : null);
      setStep('review');
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Não consegui ler este comprovante. Tente outra foto ou digite manualmente.'
      );
      setStep('error');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      analyzeViaApi({
        imageBase64: result,
        mimeType: file.type || 'image/jpeg',
        nextSource: 'foto',
        imgPreview: result,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmSave = (e: React.FormEvent) => {
    e.preventDefault();
    const amountCents = parseCurrencyInputToCents(amountStr);
    if (!merchant.trim() || amountCents <= 0) return;

    const chosenCat = categories.find((c) => c.id === categoryId);

    onSaveExpense({
      amountCents,
      merchant: merchant.trim(),
      description: description.trim() || null,
      categoryId: categoryId || 'outros',
      categoryName: chosenCat?.name,
      categoryColor: chosenCat?.color,
      categoryIcon: chosenCat?.icon,
      subcategory: subcategory.trim() || null,
      paymentMethod,
      expenseDate,
      source,
      aiConfidence,
      receiptKey: null,
      receiptUrl: previewImage || null,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-new-expense-title"
    >
      <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#222C38] bg-white/95 dark:bg-[#151B23]/95 backdrop-blur-xs">
          <div>
            <p className="text-xs font-medium text-emerald-600 dark:text-[#4EDEA3]">
              {step === 'review' ? 'Revisar Detalhes da Despesa' : 'Novo Lançamento'}
            </p>
            <h2
              id="modal-new-expense-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              {step === 'choose' && 'Registrar Nova Despesa'}
              {step === 'scanning' && 'Analisando Comprovante...'}
              {step === 'error' && 'Não Foi Possível Processar'}
              {step === 'review' && 'Detalhes da Despesa'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C2025] transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'choose' && (
          <div className="p-6 space-y-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mt-4">
                  Enviar Foto do Comprovante
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Envie uma foto de cupom fiscal ou comprovante para extração automática via IA.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setSource('manual');
                  setStep('review');
                }}
                className="p-5 rounded-2xl border border-slate-200 dark:border-[#222C38] hover:border-emerald-500/40 bg-slate-50 dark:bg-[#101419] text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-[#1C2025] text-slate-700 dark:text-slate-200 flex items-center justify-center">
                  <ArrowRight className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mt-4">
                  Preencher Manualmente
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Insira estabelecimento, valor, data e categoria diretamente no formulário.
                </p>
              </button>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#101419] p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="w-4 h-4 text-violet-500" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    Descrever em Texto Livre
                  </span>
                </div>
                <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                  <Mic className="w-3.5 h-3.5" />
                  Áudio disponível na Etapa 5
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder="Descreva o gasto (estabelecimento, valor, pagamento)..."
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  type="button"
                  disabled={!freeText.trim()}
                  onClick={() =>
                    analyzeViaApi({
                      text: freeText,
                      nextSource: 'texto',
                    })
                  }
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" />
                  Processar com IA
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'scanning' && (
          <div className="p-10 flex flex-col items-center text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center animate-pulse">
              <Sparkles className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              Processando informações via Workers AI...
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Aguarde alguns segundos enquanto extraímos os campos da despesa.
            </p>
          </div>
        )}

        {step === 'error' && (
          <div className="p-10 flex flex-col items-center text-center max-w-lg mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{errorMessage}</h3>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('choose')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-sm transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Tentar Novamente
              </button>
              <button
                type="button"
                onClick={() => {
                  setSource('manual');
                  setStep('review');
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] hover:bg-slate-100 dark:hover:bg-[#1C2025] text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors"
              >
                Digitar Manualmente
              </button>
            </div>
          </div>
        )}

        {step === 'review' && (
          <form onSubmit={handleConfirmSave} className="p-6 space-y-5">
            {previewImage && (
              <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] overflow-hidden bg-slate-100 dark:bg-[#0B0F14]">
                <SafeImage
                  src={previewImage}
                  alt="Prévia do comprovante"
                  className="w-full h-48 object-cover"
                  fallbackType="receipt"
                />
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Estabelecimento / Fornecedor
                </label>
                <input
                  type="text"
                  required
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="Nome do estabelecimento"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Valor Total (R$)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm font-mono-tabular font-semibold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Categoria
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {categories.length === 0 ? (
                    <option value="outros">Outros</option>
                  ) : (
                    categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Data
                </label>
                <input
                  type="date"
                  required
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm font-mono-tabular text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Método de Pagamento
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[]).map((method) => (
                    <option key={method} value={method}>
                      {PAYMENT_METHOD_LABELS[method]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Subcategoria (opcional)
                </label>
                <input
                  type="text"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  placeholder="Ex: Supermercado"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Descrição (opcional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Observações sobre a despesa"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-[#222C38]">
              <button
                type="button"
                onClick={() => setStep('choose')}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C2025] transition-colors"
              >
                Voltar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-sm transition-colors"
              >
                <CheckCircle2 className="w-4 h-4" />
                Salvar Despesa
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
