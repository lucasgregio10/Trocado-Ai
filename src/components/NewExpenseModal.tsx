import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  Upload,
  Camera,
  MessageSquareText,
  Mic,
  Square,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  RotateCcw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import {
  AiConfidenceScores,
  AiExtractResponse,
  Category,
  Expense,
  ExpenseDraftInput,
  ExpenseSource,
  PaymentMethod,
} from '../types/finance';
import {
  PAYMENT_METHOD_LABELS,
  formatCentsBRL,
  formatCentsInputMask,
  formatDateBR,
  getMaxExpenseDateISO,
  getTodaySaoPauloISO,
  parseDigitsToCents,
} from '../utils/formatters';
import { compressReceiptImage } from '../utils/imageCompression';
import { SafeImage } from './TrocadoLogo';
import { CategoryIcon } from './CategoryIcon';
import { apiFetch } from '../lib/api';

interface NewExpenseModalProps {
  isOpen: boolean;
  initialMode?: 'foto' | 'texto' | 'manual' | 'choose';
  sharedImageFile?: File | null;
  categories: Category[];
  isSaving?: boolean;
  onClose: () => void;
  onSaveExpense: (expense: ExpenseDraftInput, receiptBlob?: Blob | null) => Promise<void>;
}

type ModalStep = 'choose' | 'recording' | 'scanning' | 'error' | 'review';

const MAX_RECORD_SECONDS = 30;
const MAX_TEXT_CHARS = 500;

const SCAN_STEPS: Record<'foto' | 'texto' | 'voz', string[]> = {
  foto: [
    'Preparando imagem comprimida...',
    'Lendo estabelecimento, itens e valor total...',
    'Classificando categoria e verificando confiança...',
  ],
  texto: [
    'Interpretando descrição em português...',
    'Identificando valor, data e estabelecimento...',
    'Classificando categoria automaticamente...',
  ],
  voz: [
    'Enviando gravação de voz...',
    'Transcrevendo áudio com Whisper...',
    'Extraindo campos da despesa...',
  ],
};

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Não foi possível ler o áudio gravado.'));
        return;
      }
      const commaIdx = reader.result.indexOf(',');
      resolve(commaIdx >= 0 ? reader.result.slice(commaIdx + 1) : reader.result);
    };
    reader.onerror = () => reject(new Error('Erro ao converter o áudio gravado.'));
    reader.readAsDataURL(blob);
  });
}

function ConfidenceDot({
  score,
  hasValue = true,
  label,
}: {
  score: number | null;
  hasValue?: boolean;
  label: string;
}) {
  if (score === null) return null;
  const isHigh = score >= 0.8 && hasValue;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium"
      title={
        isHigh
          ? `${label}: confiança alta (${Math.round(score * 100)}%)`
          : `${label}: confira este campo (${Math.round(score * 100)}%)`
      }
    >
      <span
        className={`w-2 h-2 rounded-full inline-block ${
          isHigh ? 'bg-emerald-500' : 'bg-amber-400'
        }`}
      />
      <span className={isHigh ? 'text-emerald-600 dark:text-[#4EDEA3]' : 'text-amber-600 dark:text-amber-400'}>
        {isHigh ? 'Alta' : 'Revisar'}
      </span>
    </span>
  );
}

export function NewExpenseModal({
  isOpen,
  initialMode = 'choose',
  sharedImageFile = null,
  categories,
  isSaving = false,
  onClose,
  onSaveExpense,
}: NewExpenseModalProps) {
  const [step, setStep] = useState<ModalStep>(initialMode === 'manual' ? 'review' : 'choose');
  const [freeText, setFreeText] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string>('');
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [source, setSource] = useState<ExpenseSource>('manual');
  const [confidence, setConfidence] = useState<AiConfidenceScores | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [scanStepIndex, setScanStepIndex] = useState(0);

  const [recordSeconds, setRecordSeconds] = useState(0);

  const [merchant, setMerchant] = useState('');
  const [description, setDescription] = useState('');
  const [amountCents, setAmountCents] = useState(0);
  const [expenseDate, setExpenseDate] = useState(getTodaySaoPauloISO());
  const [categoryId, setCategoryId] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix');
  const [duplicates, setDuplicates] = useState<Expense[]>([]);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const recordIntervalRef = useRef<number | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const cancelRecordRef = useRef(false);
  const processedSharedFileRef = useRef<File | null>(null);

  const stopRecordingResources = useCallback(() => {
    if (recordIntervalRef.current !== null) {
      window.clearInterval(recordIntervalRef.current);
      recordIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const extractViaAi = useCallback(
    async (params: {
      kind: 'image' | 'text' | 'audio';
      data: string;
      nextSource: 'foto' | 'texto' | 'voz';
      imgPreview?: string;
      blob?: Blob | null;
    }) => {
      setSource(params.nextSource);
      setPreviewImage(params.imgPreview || '');
      setCompressedBlob(params.blob ?? null);
      setTranscript(null);
      setConfidence(null);
      setErrorMessage('');
      setFormError(null);
      setStep('scanning');

      try {
        const res = await apiFetch<AiExtractResponse>('/api/ai/extract', {
          method: 'POST',
          body: JSON.stringify({
            kind: params.kind,
            data: params.data,
          }),
        });

        const { suggestion, transcript: audioTranscript } = res;

        setMerchant(suggestion.merchant || '');
        setAmountCents(suggestion.amountCents ?? 0);
        setExpenseDate(suggestion.expenseDate || '');
        setCategoryId(suggestion.categoryId || categories[0]?.id || '');
        setSubcategory(suggestion.subcategory || '');
        setPaymentMethod(suggestion.paymentMethod || 'outro');
        setDescription(suggestion.description || '');
        setConfidence(suggestion.confidence);
        setTranscript(audioTranscript);
        setStep('review');
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Não consegui ler esta despesa. Tente outra foto ou digite manualmente.'
        );
        setStep('error');
      }
    },
    [categories]
  );

  const handleImageFile = useCallback(
    async (file: File) => {
      setSource('foto');
      setStep('scanning');
      setErrorMessage('');

      try {
        const compressed = await compressReceiptImage(file);
        await extractViaAi({
          kind: 'image',
          data: compressed.dataUrl,
          nextSource: 'foto',
          imgPreview: compressed.dataUrl,
          blob: compressed.blob,
        });
      } catch (err) {
        setErrorMessage(
          err instanceof Error
            ? err.message
            : 'Não foi possível processar a imagem selecionada.'
        );
        setStep('error');
      }
    },
    [extractViaAi]
  );

  useEffect(() => {
    if (!isOpen) {
      cancelRecordRef.current = true;
      processedSharedFileRef.current = null;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      stopRecordingResources();
      return;
    }

    cancelRecordRef.current = false;
    setMerchant('');
    setDescription('');
    setAmountCents(0);
    setExpenseDate(getTodaySaoPauloISO());
    setCategoryId((prev) => prev || categories[0]?.id || '');
    setSubcategory('');
    setPaymentMethod('pix');
    setPreviewImage('');
    setCompressedBlob(null);
    setConfidence(null);
    setTranscript(null);
    setFreeText('');
    setErrorMessage('');
    setFormError(null);
    setDuplicates([]);
    setRecordSeconds(0);

    if (sharedImageFile) {
      if (processedSharedFileRef.current !== sharedImageFile) {
        processedSharedFileRef.current = sharedImageFile;
        void handleImageFile(sharedImageFile);
      }
      return;
    }

    if (initialMode === 'manual') {
      setSource('manual');
      setStep('review');
    } else {
      setSource(initialMode === 'choose' ? 'manual' : initialMode);
      setStep('choose');
    }
  }, [isOpen, initialMode, sharedImageFile, categories, stopRecordingResources, handleImageFile]);

  useEffect(() => {
    return () => {
      cancelRecordRef.current = true;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      stopRecordingResources();
    };
  }, [stopRecordingResources]);

  useEffect(() => {
    if (step !== 'scanning') {
      setScanStepIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setScanStepIndex((prev) => (prev + 1) % 3);
    }, 1400);
    return () => window.clearInterval(timer);
  }, [step]);

  useEffect(() => {
    if (!isOpen || step !== 'review' || amountCents <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
      setDuplicates([]);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      const params = new URLSearchParams({
        amount_cents: String(amountCents),
        expense_date: expenseDate,
      });
      if (merchant.trim()) {
        params.set('merchant', merchant.trim());
      }
      apiFetch<{ items: Expense[] }>(`/api/expenses/duplicates?${params.toString()}`)
        .then((res) => {
          if (!cancelled) {
            setDuplicates(res.items || []);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDuplicates([]);
          }
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, step, amountCents, expenseDate, merchant]);

  if (!isOpen) return null;

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    await handleImageFile(file);
  };

  const handleStartVoiceRecording = async () => {
    setErrorMessage('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMessage('Gravação de áudio não é suportada neste navegador.');
      setStep('error');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const mimeCandidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
      ];
      const supportedMime = mimeCandidates.find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = supportedMime
        ? new MediaRecorder(stream, { mimeType: supportedMime })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      cancelRecordRef.current = false;
      setRecordSeconds(0);
      setSource('voz');
      setStep('recording');

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          audioChunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stopRecordingResources();
        if (cancelRecordRef.current) {
          return;
        }
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (audioBlob.size === 0) {
          setErrorMessage('Nenhum áudio foi capturado. Tente novamente.');
          setStep('error');
          return;
        }
        try {
          const base64Audio = await blobToBase64(audioBlob);
          await extractViaAi({
            kind: 'audio',
            data: base64Audio,
            nextSource: 'voz',
          });
        } catch (err) {
          setErrorMessage(
            err instanceof Error ? err.message : 'Não foi possível enviar o áudio gravado.'
          );
          setStep('error');
        }
      };

      recorder.start(250);

      recordIntervalRef.current = window.setInterval(() => {
        setRecordSeconds((prev) => {
          const next = prev + 1;
          if (next >= MAX_RECORD_SECONDS) {
            if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
              mediaRecorderRef.current.stop();
            }
            return MAX_RECORD_SECONDS;
          }
          return next;
        });
      }, 1000);
    } catch {
      stopRecordingResources();
      setErrorMessage(
        'Não foi possível acessar o microfone. Verifique a permissão no navegador.'
      );
      setStep('error');
    }
  };

  const handleStopVoiceRecording = () => {
    cancelRecordRef.current = false;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleCancelVoiceRecording = () => {
    cancelRecordRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopRecordingResources();
    setStep('choose');
  };

  const handleDiscard = () => {
    setCompressedBlob(null);
    setPreviewImage('');
    setConfidence(null);
    setTranscript(null);
    onClose();
  };

  const handleConfirmSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (amountCents <= 0) {
      setFormError('Informe um valor maior que zero.');
      return;
    }
    if (!expenseDate || !/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
      setFormError('Selecione a data da despesa.');
      return;
    }
    if (!merchant.trim()) {
      setFormError('Informe o nome do estabelecimento.');
      return;
    }
    if (!categoryId) {
      setFormError('Selecione uma categoria.');
      return;
    }

    const avgConfidence = confidence
      ? Math.round(
          ((confidence.merchant + confidence.amount + confidence.date + confidence.category) / 4) *
            100
        )
      : null;

    try {
      await onSaveExpense(
        {
          amountCents,
          merchant: merchant.trim(),
          description: description.trim() || null,
          categoryId,
          subcategory: subcategory.trim() || null,
          paymentMethod,
          expenseDate,
          source,
          aiConfidence: avgConfidence,
          receiptKey: null,
        },
        source === 'foto' ? compressedBlob : null
      );
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Não foi possível salvar a despesa.');
    }
  };

  const isAmountUncertain = confidence !== null && (confidence.amount < 0.8 || amountCents <= 0);
  const isDateUncertain = confidence !== null && (confidence.date < 0.8 || !expenseDate);
  const isMerchantUncertain =
    confidence !== null && (confidence.merchant < 0.8 || !merchant.trim());
  const isCategoryUncertain = confidence !== null && confidence.category < 0.8;

  const activeScanMessages =
    source === 'foto' || source === 'texto' || source === 'voz'
      ? SCAN_STEPS[source]
      : SCAN_STEPS.foto;

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
              {step === 'review'
                ? source === 'manual'
                  ? 'Lançamento Manual'
                  : 'Revisar Sugestão da IA'
                : 'Novo Lançamento'}
            </p>
            <h2
              id="modal-new-expense-title"
              className="text-lg font-bold text-slate-900 dark:text-white"
            >
              {step === 'choose' && 'Registrar Nova Despesa'}
              {step === 'recording' && 'Gravando Áudio...'}
              {step === 'scanning' && 'Processando com IA...'}
              {step === 'error' && 'Não Foi Possível Processar'}
              {step === 'review' &&
                (source === 'manual' ? 'Nova Despesa Manual' : 'Confirmar Dados da Despesa')}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleDiscard}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1C2025] transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {step === 'choose' && (
          <div className="p-6 space-y-6">
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              capture="environment"
              onChange={handleFileSelected}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              onChange={handleFileSelected}
              className="hidden"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Foto / Comprovante */}
              <div className="p-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 space-y-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center">
                  <Camera className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Foto do Comprovante
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Cupom fiscal, nota ou comprovante Pix. Comprimido automaticamente antes do envio.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => cameraInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-xs transition-colors"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    Câmera
                  </button>
                  <button
                    type="button"
                    onClick={() => galleryInputRef.current?.click()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] hover:bg-slate-100 dark:hover:bg-[#1C2025] text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Galeria
                  </button>
                </div>
              </div>

              {/* Manual */}
              <button
                type="button"
                onClick={() => {
                  setSource('manual');
                  setConfidence(null);
                  setTranscript(null);
                  setPreviewImage('');
                  setCompressedBlob(null);
                  setExpenseDate(getTodaySaoPauloISO());
                  setStep('review');
                }}
                className="p-5 rounded-2xl border border-slate-200 dark:border-[#222C38] hover:border-emerald-500/40 bg-slate-50 dark:bg-[#101419] text-left transition-colors flex flex-col justify-between"
              >
                <div className="w-10 h-10 rounded-xl bg-slate-200 dark:bg-[#1C2025] text-slate-700 dark:text-slate-200 flex items-center justify-center">
                  <ArrowRight className="w-5 h-5" />
                </div>
                <div className="mt-4">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                    Preencher Manualmente
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Insira valor, data, estabelecimento, categoria e forma de pagamento.
                  </p>
                </div>
              </button>
            </div>

            {/* Texto Livre + Voz */}
            <div className="rounded-2xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#101419] p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MessageSquareText className="w-4 h-4 text-violet-500" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">
                    Descrever por Texto ou Voz
                  </span>
                </div>
                <span className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
                  {freeText.length}/{MAX_TEXT_CHARS}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <label htmlFor="new-expense-freetext" className="sr-only">
                  Descrição da despesa por texto
                </label>
                <input
                  id="new-expense-freetext"
                  type="text"
                  maxLength={MAX_TEXT_CHARS}
                  value={freeText}
                  onChange={(e) => setFreeText(e.target.value)}
                  placeholder='Ex: "almocei no restaurante 45 reais ontem"'
                  className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] text-sm text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                <button
                  type="button"
                  disabled={!freeText.trim()}
                  onClick={() =>
                    extractViaAi({
                      kind: 'text',
                      data: freeText.trim(),
                      nextSource: 'texto',
                    })
                  }
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" />
                  Analisar Texto
                </button>
                <button
                  type="button"
                  onClick={handleStartVoiceRecording}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 text-sm font-semibold transition-colors whitespace-nowrap"
                >
                  <Mic className="w-4 h-4" />
                  Gravar Áudio
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'recording' && (
          <div className="p-10 flex flex-col items-center text-center space-y-5">
            <div className="relative flex items-center justify-center w-20 h-20">
              <span className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
              <div className="relative w-16 h-16 rounded-full bg-red-500 text-white flex items-center justify-center shadow-lg">
                <Mic className="w-7 h-7" />
              </div>
            </div>

            <div>
              <p className="text-2xl font-bold font-mono-tabular text-slate-900 dark:text-white">
                00:{String(recordSeconds).padStart(2, '0')}{' '}
                <span className="text-sm font-normal text-slate-400">
                  / 00:{MAX_RECORD_SECONDS}
                </span>
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Fale o estabelecimento, valor e forma de pagamento em português.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCancelVoiceRecording}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C2025]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleStopVoiceRecording}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-[#0B0F14] font-semibold text-sm"
              >
                <Square className="w-4 h-4 fill-current" />
                Parar e Extrair
              </button>
            </div>
          </div>
        )}

        {step === 'scanning' && (
          <div className="p-8 sm:p-10 flex flex-col items-center text-center space-y-5">
            <div className="relative w-full max-w-sm h-56 rounded-2xl border border-emerald-500/30 bg-slate-900 overflow-hidden flex items-center justify-center">
              {previewImage ? (
                <img
                  src={previewImage}
                  alt="Comprovante sendo analisado"
                  className="w-full h-full object-cover opacity-55"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 text-emerald-400">
                  <Sparkles className="w-10 h-10" />
                  <span className="text-xs font-medium text-slate-300">
                    {source === 'voz' ? 'Áudio capturado' : 'Texto enviado'}
                  </span>
                </div>
              )}

              <div
                className="animate-scan-line absolute inset-x-0 top-0 h-1 bg-linear-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_16px_rgba(16,185,129,0.9)]"
                aria-hidden="true"
              />
            </div>

            <div className="space-y-2 max-w-md">
              <p className="text-sm font-semibold text-slate-900 dark:text-white flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                <span>{activeScanMessages[scanStepIndex]}</span>
              </p>
              <div className="flex items-center justify-center gap-1.5 pt-1">
                {activeScanMessages.map((label, idx) => (
                  <span
                    key={label}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === scanStepIndex
                        ? 'w-6 bg-emerald-500'
                        : 'w-2 bg-slate-200 dark:bg-[#222C38]'
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                A IA irá sugerir os dados para você revisar antes de salvar.
              </p>
            </div>
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
                  setConfidence(null);
                  setExpenseDate(getTodaySaoPauloISO());
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
          <form onSubmit={handleConfirmSave} className="p-6 space-y-5" noValidate>
            {confidence && (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-4 py-2.5 text-xs">
                <div className="flex items-center gap-2 text-violet-700 dark:text-violet-300 font-medium">
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span>
                    Sugestão preenchida pela IA. Confira os campos destacados em amarelo antes de salvar.
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[11px] text-slate-600 dark:text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Alta confiança
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400" /> Revisar
                  </span>
                </div>
              </div>
            )}

            {transcript && (
              <div className="rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] p-3 text-xs">
                <p className="text-slate-500 dark:text-slate-400 mb-0.5">Áudio transcrito:</p>
                <p className="text-slate-800 dark:text-slate-200 italic">“{transcript}”</p>
              </div>
            )}

            {formError && (
              <div
                role="alert"
                className="flex items-start gap-2.5 p-3.5 rounded-xl border border-red-500/30 bg-red-500/10 text-xs text-red-600 dark:text-red-300"
              >
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {duplicates.length > 0 && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold">Possível lançamento duplicado encontrado</p>
                  <p className="mt-0.5 opacity-90">
                    Já existe {duplicates.length === 1 ? 'uma despesa' : `${duplicates.length} despesas`} de{' '}
                    {formatCentsBRL(amountCents)} próxima a esta data ({duplicates[0].merchant} em{' '}
                    {formatDateBR(duplicates[0].expenseDate)}).
                  </p>
                </div>
              </div>
            )}

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
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="new-expense-amount"
                    className="text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Valor Total
                  </label>
                  <ConfidenceDot
                    score={confidence ? confidence.amount : null}
                    hasValue={amountCents > 0}
                    label="Valor"
                  />
                </div>
                <input
                  id="new-expense-amount"
                  type="text"
                  inputMode="numeric"
                  required
                  value={formatCentsInputMask(amountCents)}
                  onChange={(e) => setAmountCents(parseDigitsToCents(e.target.value))}
                  placeholder="R$ 0,00"
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-base font-mono-tabular font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isAmountUncertain
                      ? 'border-amber-400/80 bg-amber-500/5'
                      : 'border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14]'
                  }`}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="new-expense-date"
                    className="text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Data
                  </label>
                  <ConfidenceDot
                    score={confidence ? confidence.date : null}
                    hasValue={Boolean(expenseDate)}
                    label="Data"
                  />
                </div>
                <input
                  id="new-expense-date"
                  type="date"
                  required
                  max={getMaxExpenseDateISO()}
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm font-mono-tabular text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isDateUncertain
                      ? 'border-amber-400/80 bg-amber-500/5'
                      : 'border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14]'
                  }`}
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <label
                    htmlFor="new-expense-merchant"
                    className="text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Estabelecimento / Fornecedor
                  </label>
                  <ConfidenceDot
                    score={confidence ? confidence.merchant : null}
                    hasValue={Boolean(merchant.trim())}
                    label="Estabelecimento"
                  />
                </div>
                <input
                  id="new-expense-merchant"
                  type="text"
                  required
                  value={merchant}
                  onChange={(e) => setMerchant(e.target.value)}
                  placeholder="Ex: Supermercado, Farmácia, Restaurante..."
                  className={`w-full px-3.5 py-2.5 rounded-xl border text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                    isMerchantUncertain
                      ? 'border-amber-400/80 bg-amber-500/5'
                      : 'border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14]'
                  }`}
                />
              </div>

              <div className="sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    id="new-expense-category-label"
                    className="text-xs font-medium text-slate-600 dark:text-slate-400"
                  >
                    Categoria
                  </span>
                  <ConfidenceDot
                    score={confidence ? confidence.category : null}
                    hasValue={Boolean(categoryId)}
                    label="Categoria"
                  />
                </div>
                {categories.length === 0 ? (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Carregando categorias...
                  </p>
                ) : (
                  <div
                    role="group"
                    aria-labelledby="new-expense-category-label"
                    className={`flex flex-wrap gap-2 p-2 rounded-xl ${
                      isCategoryUncertain ? 'border border-amber-400/80 bg-amber-500/5' : ''
                    }`}
                  >
                    {categories.map((cat) => {
                      const active = categoryId === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setCategoryId(cat.id)}
                          className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium transition-colors ${
                            active
                              ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-[#4EDEA3] font-semibold'
                              : 'border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
                          }`}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-xs shrink-0"
                            style={{ backgroundColor: cat.color }}
                          />
                          <CategoryIcon category={cat.name} icon={cat.icon} className="w-3.5 h-3.5" />
                          <span>{cat.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <label
                  htmlFor="new-expense-payment"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
                >
                  Forma de Pagamento
                </label>
                <select
                  id="new-expense-payment"
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
                <label
                  htmlFor="new-expense-subcategory"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
                >
                  Subcategoria (opcional)
                </label>
                <input
                  id="new-expense-subcategory"
                  type="text"
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  placeholder="Ex: Supermercado, Combustível"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="new-expense-description"
                  className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
                >
                  Observação (opcional)
                </label>
                <textarea
                  id="new-expense-description"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes ou observações adicionais sobre a compra"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-slate-50 dark:bg-[#0B0F14] text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200 dark:border-[#222C38]">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleDiscard}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-[#1C2025] transition-colors"
              >
                Descartar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-[#0B0F14] font-semibold text-sm transition-colors"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-4 h-4" />
                )}
                {isSaving ? 'Salvando...' : 'Salvar despesa'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
