import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Camera,
  Upload,
  MessageSquareText,
  Mic,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
} from 'lucide-react';
import { Expense, ExpenseItem, ExpenseOrigin } from '../types/finance';
import { STITCH_IMAGES } from '../data/mockFinanceData';
import { formatBRL } from '../utils/formatters';
import { SafeImage } from './TrocadoLogo';

interface NewExpenseModalProps {
  isOpen: boolean;
  initialMode?: 'scanner' | 'text' | 'manual';
  categories: string[];
  onClose: () => void;
  onSaveExpense: (expense: Expense) => void;
}

type ModalStep = 'choose' | 'scanning' | 'error' | 'review';

export function NewExpenseModal({
  isOpen,
  initialMode = 'scanner',
  categories,
  onClose,
  onSaveExpense,
}: NewExpenseModalProps) {
  const [step, setStep] = useState<ModalStep>(initialMode === 'manual' ? 'review' : 'choose');
  const [freeText, setFreeText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [scanProgress, setScanProgress] = useState(18);
  const [errorMessage, setErrorMessage] = useState('');
  const [previewImage, setPreviewImage] = useState<string>(STITCH_IMAGES.receiptOcrPreview);
  const [origin, setOrigin] = useState<ExpenseOrigin>('ai_scanner');
  const [confidence, setConfidence] = useState<number>(98);

  // Editable review fields
  const [merchant, setMerchant] = useState('Restaurante Sabor & Arte Ltda');
  const [cnpj, setCnpj] = useState('12.345.678/0001-90');
  const [amountStr, setAmountStr] = useState('156.75');
  const [date, setDate] = useState('2024-10-24');
  const [time, setTime] = useState('13:42');
  const [category, setCategory] = useState('Alimentação');
  const [subcategory, setSubcategory] = useState('Restaurante / Almoço Executivo');
  const [paymentMethod, setPaymentMethod] = useState('Cartão Nubank');
  const [items, setItems] = useState<ExpenseItem[]>([
    { name: 'Buffet Executivo 1x', quantity: '1x', price: 89.9 },
    { name: 'Suco Natural Laranja', quantity: '1x', price: 28.0 },
    { name: 'Sobremesa Petit Gateau', quantity: '1x', price: 24.6 },
    { name: 'Taxa de Serviço (10%)', quantity: '1x', price: 14.25 },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (initialMode === 'manual') {
      setOrigin('manual');
      setMerchant('');
      setCnpj('');
      setAmountStr('');
      setDate('2024-10-24');
      setTime('14:00');
      setCategory('Alimentação');
      setSubcategory('Geral');
      setPaymentMethod('Cartão Nubank');
      setItems([]);
      setPreviewImage('');
      setStep('review');
    } else {
      setStep('choose');
      setFreeText('');
      setErrorMessage('');
    }
  }, [isOpen, initialMode]);

  useEffect(() => {
    if (step !== 'scanning') return;
    setScanProgress(20);
    const t1 = setTimeout(() => setScanProgress(55), 350);
    const t2 = setTimeout(() => setScanProgress(84), 750);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [step]);

  if (!isOpen) return null;

  const runAnalysis = async (payload: {
    text?: string;
    imageBase64?: string;
    mimeType?: string;
    simulateError?: boolean;
    nextOrigin: ExpenseOrigin;
    imgPreview?: string;
  }) => {
    setOrigin(payload.nextOrigin);
    if (payload.imgPreview !== undefined) {
      setPreviewImage(payload.imgPreview);
    }
    setStep('scanning');
    setErrorMessage('');

    try {
      const [res] = await Promise.all([
        fetch('/api/analyze-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: payload.text,
            imageBase64: payload.imageBase64,
            mimeType: payload.mimeType,
            simulateError: payload.simulateError,
          }),
        }),
        new Promise((r) => setTimeout(r, 950)),
      ]);

      const json = await res.json();
      if (!res.ok) {
        setErrorMessage(
          json.error || 'Não consegui ler este comprovante. Tente outra foto ou digite manualmente.'
        );
        setStep('error');
        return;
      }

      const d = json.data;
      setMerchant(d.merchant || 'Estabelecimento Comercial');
      setCnpj(d.cnpj || '');
      setAmountStr(String(Number(d.amount || 0).toFixed(2)));
      setDate(d.date || '2024-10-24');
      setTime(d.time || '13:42');
      setCategory(d.category || 'Outros');
      setSubcategory(d.subcategory || 'Geral');
      setPaymentMethod(d.paymentMethod || 'Cartão Nubank');
      setConfidence(d.confidence || 98);
      setItems(Array.isArray(d.items) ? d.items : []);
      setScanProgress(100);
      setStep('review');
    } catch {
      setErrorMessage(
        'Não consegui ler este comprovante. Tente outra foto ou digite manualmente.'
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
      runAnalysis({
        imageBase64: result,
        mimeType: file.type || 'image/jpeg',
        nextOrigin: 'ai_scanner',
        imgPreview: result,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSimulateVoice = () => {
    setIsListening(true);
    setTimeout(() => {
      setIsListening(false);
      const dictated = 'Farmácia Droga Raia 65,40 no Pix hoje';
      setFreeText(dictated);
      runAnalysis({
        text: dictated,
        nextOrigin: 'ai_audio',
        imgPreview: '',
      });
    }, 900);
  };

  const handleConfirmSave = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amountStr.replace(',', '.'));
    if (!merchant.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return;
    }

    const newExp: Expense = {
      id: `exp-${Date.now()}`,
      merchant: merchant.trim(),
      cnpj: cnpj.trim() || undefined,
      amount: numericAmount,
      date,
      time,
      category,
      subcategory: subcategory.trim() || 'Geral',
      paymentMethod,
      origin,
      confidence: origin === 'manual' ? undefined : confidence,
      receiptImage: previewImage || undefined,
      items: items.length > 0 ? items : undefined,
      status: 'Conciliado',
    };
    onSaveExpense(newExp);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/65 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-new-expense-title"
    >
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] shadow-2xl">
        {/* Modal Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-[#222C38] bg-white/95 dark:bg-[#151B23]/95 backdrop-blur-xs">
          <div>
            <p className="text-xs font-medium text-emerald-600 dark:text-[#4EDEA3]">
              {step === 'review' ? 'Revisar Detalhes da Despesa' : 'Lançamento Inteligente'}
            </p>
            <h2
              id="modal-new-expense-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              {step === 'choose' && 'Nova Despesa'}
              {step === 'scanning' && 'Analisando Comprovante Fiscal'}
              {step === 'error' && 'Falha na Leitura do Comprovante'}
              {step === 'review' && (origin === 'manual' ? 'Preencher Despesa' : 'Confirmar Dados Extraídos pela IA')}
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

        {/* Step 1: Choose Input Method */}
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
                onClick={() =>
                  runAnalysis({
                    nextOrigin: 'ai_scanner',
                    imgPreview: STITCH_IMAGES.receiptOcrPreview,
                  })
                }
                className="p-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 text-left transition-colors group"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                    <Camera className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold text-emerald-600 dark:text-[#4EDEA3]">
                    IA Recomendado
                  </span>
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mt-4">
                  Escanear Comprovante (Demo OCR)
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Testa o scanner Trocado Vision em um cupom fiscal NFC-e real com extração de itens e CNPJ.
                </p>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-5 rounded-2xl border border-slate-200 dark:border-[#222C38] hover:border-emerald-500/40 bg-slate-50 dark:bg-[#101419] text-left transition-colors"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-[#1C2025] text-slate-700 dark:text-slate-200 flex items-center justify-center">
                  <Upload className="w-5 h-5" />
                </div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white mt-4">
                  Enviar Imagem do Dispositivo
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Faça upload de foto de cupom fiscal, comprovante PIX ou nota de aplicativo.
                </p>
              </button>
            </div>

            {/* Natural Language Input */}
            <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#101419] p-5 space-y-4">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="w-4 h-4 text-violet-500" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    Texto Livre ou Voz em Linguagem Natural
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSimulateVoice}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    isListening
                      ? 'bg-red-500 text-white'
                      : 'border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C2025]'
                  }`}
                >
                  <Mic className="w-3.5 h-3.5" />
                  {isListening ? 'Ouvindo...' : 'Ditar por Voz'}
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <input
                  type="text"
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder='Ex: "Almoço no Outback R$ 89 ontem no débito"'
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  type="button"
                  disabled={!freeText.trim()}
                  onClick={() =>
                    runAnalysis({
                      text: freeText,
                      nextOrigin: 'ai_text',
                      imgPreview: '',
                    })
                  }
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" />
                  Processar com IA
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500 dark:text-slate-400">Sugestões:</span>
                {[
                  'Almoço no Outback R$ 89 ontem no débito',
                  'Gasolina Posto Shell R$ 220 no crédito',
                  'Farmácia Droga Raia 65,40 no Pix',
                ].map((sample) => (
                  <button
                    key={sample}
                    type="button"
                    onClick={() => setFreeText(sample)}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-[#151B23] border border-slate-200 dark:border-[#222C38] text-slate-700 dark:text-slate-300 hover:border-violet-400 transition-colors"
                  >
                    {sample}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200 dark:border-[#222C38]">
              <button
                type="button"
                onClick={() =>
                  runAnalysis({
                    simulateError: true,
                    nextOrigin: 'ai_scanner',
                    imgPreview: STITCH_IMAGES.receiptOcrPreview,
                  })
                }
                className="text-xs text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors"
              >
                Simular comprovante ilegível (teste de erro)
              </button>

              <button
                type="button"
                onClick={() => {
                  setOrigin('manual');
                  setMerchant('');
                  setCnpj('');
                  setAmountStr('');
                  setPreviewImage('');
                  setItems([]);
                  setStep('review');
                }}
                className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-[#4EDEA3] hover:underline"
              >
                Prefere preencher manualmente? Abrir formulário clássico
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Scanning */}
        {step === 'scanning' && (
          <div className="p-8 flex flex-col items-center text-center space-y-6">
            <div className="relative w-full max-w-sm h-56 rounded-2xl overflow-hidden border-2 border-dashed border-emerald-500/60 bg-slate-900">
              {previewImage ? (
                <SafeImage
                  src={previewImage}
                  alt="Comprovante em análise"
                  className="w-full h-full object-cover opacity-80"
                  fallbackType="receipt"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-emerald-400">
                  <Sparkles className="w-10 h-10" />
                </div>
              )}
              <div className="absolute inset-x-0 top-0 h-1 bg-emerald-400 shadow-[0_0_16px_#10B981] animate-scan-line" />
            </div>

            <div className="max-w-md w-full space-y-3">
              <div className="flex items-center justify-between text-xs font-mono-tabular">
                <span className="text-emerald-600 dark:text-[#4EDEA3] font-semibold">
                  Trocado Vision OCR · Extraindo metadados fiscais
                </span>
                <span className="text-slate-500 dark:text-slate-400">{scanProgress}%</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-[#1C2025] overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Identificando estabelecimento, CNPJ, data, itens de consumo e categoria tributária.
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {step === 'error' && (
          <div className="p-10 flex flex-col items-center text-center max-w-lg mx-auto space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-red-500/15 text-red-500 flex items-center justify-center">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              {errorMessage}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Dica: evite reflexos fortes ou amassados sobre o QR Code e o valor total do cupom fiscal.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setStep('choose')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-sm transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Tentar Outra Foto
              </button>
              <button
                type="button"
                onClick={() => {
                  setOrigin('manual');
                  setMerchant('');
                  setAmountStr('');
                  setPreviewImage('');
                  setItems([]);
                  setStep('review');
                }}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] hover:bg-slate-100 dark:hover:bg-[#1C2025] text-sm font-medium text-slate-700 dark:text-slate-200 transition-colors"
              >
                Digitar Manualmente
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Confirm */}
        {step === 'review' && (
          <form onSubmit={handleConfirmSave} className="p-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Scanned Receipt Preview */}
              {previewImage && (
                <div className="lg:col-span-5 space-y-4">
                  <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#101419] overflow-hidden">
                    <div className="px-4 py-3 border-b border-slate-200 dark:border-[#222C38] flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-700 dark:text-slate-200">
                        Comprovante Digitalizado
                      </span>
                      <span className="font-mono-tabular text-emerald-600 dark:text-[#4EDEA3]">
                        {confidence}% precisão OCR
                      </span>
                    </div>
                    <SafeImage
                      src={previewImage}
                      alt="Comprovante escaneado"
                      className="w-full h-56 object-cover"
                      fallbackType="receipt"
                    />
                    {items.length > 0 && (
                      <div className="p-4 space-y-2 border-t border-slate-200 dark:border-[#222C38]">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                          Itens detectados ({items.length})
                        </p>
                        <div className="space-y-1.5">
                          {items.map((item, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-300"
                            >
                              <span className="truncate pr-2">
                                {item.quantity} · {item.name}
                              </span>
                              <span className="font-mono-tabular shrink-0">
                                {formatBRL(item.price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Right Column: Editable Fields */}
              <div className={`${previewImage ? 'lg:col-span-7' : 'lg:col-span-12'} space-y-4`}>
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
                      placeholder="Ex: Restaurante Sabor & Arte"
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
                      Categoria Principal
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      {categories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      Data
                    </label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm font-mono-tabular text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      Método de Pagamento
                    </label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    >
                      <option value="Cartão Nubank">Cartão Nubank</option>
                      <option value="Débito Itaú">Débito Itaú</option>
                      <option value="PIX Instantâneo">PIX Instantâneo</option>
                      <option value="Cartão Itaú Visa Infinite">Cartão Itaú Visa Infinite</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                      Subcategoria / Descrição
                    </label>
                    <input
                      type="text"
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      placeholder="Ex: Almoço Executivo"
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
                    Confirmar e Salvar Despesa
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
