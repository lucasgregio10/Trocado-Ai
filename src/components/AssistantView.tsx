import React, { useRef, useState } from 'react';
import { Send, Sparkles, RefreshCw, Lightbulb, MessageSquare } from 'lucide-react';
import { ChatMessage, Expense } from '../types/finance';
import { formatCentsBRL } from '../utils/formatters';
import { apiFetch } from '../lib/api';

interface AssistantViewProps {
  expenses: Expense[];
}

const SUGGESTION_CHIPS = [
  'Quanto gastei com transporte neste mês?',
  'Qual minha maior despesa do mês?',
  'Onde posso economizar?',
];

export function AssistantView({ expenses }: AssistantViewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isSending) return;

    const nowLabel = new Date().toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    });

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      timestamp: nowLabel,
      text: trimmed,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsSending(true);

    try {
      const data = await apiFetch<{
        reply: string;
        metrics?: ChatMessage['metrics'];
        highlights?: ChatMessage['highlights'];
        tip?: string;
      }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({ message: trimmed }),
      });

      const assistantMsg: ChatMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        timestamp: new Date().toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'America/Sao_Paulo',
        }),
        text: data.reply,
        metrics: data.metrics,
        highlights: data.highlights,
        tip: data.tip,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errMsg =
        err instanceof Error
          ? err.message
          : 'Não foi possível consultar o assistente agora.';
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          timestamp: nowLabel,
          text: errMsg,
        },
      ]);
    } finally {
      setIsSending(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-11rem)] lg:h-[calc(100vh-8rem)] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-violet-500" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              Assistente Trocado IA
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {expenses.length > 0
              ? `Conectado a ${expenses.length} despesas registradas na sua conta`
              : 'Pergunte sobre seus gastos, categorias e metas financeiras'}
          </p>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => setMessages([])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1C2025] self-start sm:self-auto"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Limpar Conversa
          </button>
        )}
      </div>

      {/* Chat Transcript */}
      <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] p-4 sm:p-6 space-y-6">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto py-10 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/15 text-violet-500 flex items-center justify-center">
              <MessageSquare className="w-6 h-6" />
            </div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Comece uma conversa com o Trocado
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Use uma das sugestões abaixo ou faça sua própria pergunta sobre seus lançamentos e orçamentos.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full bg-violet-500/15 text-violet-500 flex items-center justify-center shrink-0 mt-1">
                  <Sparkles className="w-4 h-4" />
                </div>
              )}

              <div
                className={`max-w-2xl space-y-2 ${
                  msg.role === 'user' ? 'items-end flex flex-col' : ''
                }`}
              >
                <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                  <span>{msg.role === 'user' ? 'Você' : 'Trocado IA'}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{msg.timestamp}</span>
                </div>

                <div
                  className={`px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'rounded-2xl rounded-br-xs bg-slate-100 dark:bg-[#1E293B] text-slate-900 dark:text-white'
                      : 'rounded-2xl rounded-bl-xs border border-violet-200 dark:border-violet-500/30 bg-slate-50/60 dark:bg-[#101419] text-slate-800 dark:text-slate-100'
                  }`}
                >
                  <p>{msg.text}</p>

                  {msg.metrics && msg.metrics.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-4">
                      {msg.metrics.map((m, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23]"
                        >
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">{m.label}</p>
                          <p className="text-sm font-bold text-slate-900 dark:text-white font-mono-tabular mt-0.5">
                            {m.value}
                          </p>
                          {m.hint && (
                            <p className="text-[11px] text-emerald-600 dark:text-[#4EDEA3] mt-0.5">
                              {m.hint}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.highlights && msg.highlights.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {msg.highlights.map((h, i) => (
                        <div
                          key={i}
                          className="px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] flex items-center justify-between gap-3 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 dark:text-white truncate">
                              {h.merchant}
                            </p>
                            <p className="text-slate-500 dark:text-slate-400 truncate">{h.meta}</p>
                          </div>
                          <span className="font-mono-tabular font-bold text-slate-900 dark:text-white shrink-0">
                            -{formatCentsBRL(h.amountCents)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.tip && (
                    <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-200">
                      <Lightbulb className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{msg.tip}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}

        {isSending && (
          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <div className="w-8 h-8 rounded-full bg-violet-500/15 text-violet-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <span>Analisando seus lançamentos...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggestion Chips + Composer */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => sendMessage(chip)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] hover:border-violet-400 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
            >
              {chip}
            </button>
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex items-center gap-2.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Pergunte sobre seus gastos, categorias ou metas..."
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSending}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-semibold text-sm transition-colors whitespace-nowrap shrink-0"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </form>
      </div>
    </div>
  );
}
