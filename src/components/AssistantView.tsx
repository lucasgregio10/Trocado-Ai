import React, { useRef, useState } from 'react';
import { Send, Sparkles, RefreshCw, MessageSquare } from 'lucide-react';
import { ChatMessage } from '../types/finance';
import { apiFetchStream } from '../lib/api';

const SUGGESTION_CHIPS = [
  'Quanto gastei neste mês por categoria?',
  'Qual foi minha maior despesa recente?',
  'Onde estou gastando mais nos últimos meses?',
];

export function AssistantView() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 30);
  };

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

    const assistantId = `ai-${Date.now() + 1}`;
    const assistantPlaceholder: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      timestamp: nowLabel,
      text: '',
    };

    const historyForApi = [...messages, userMsg]
      .filter((m) => m.text.trim().length > 0)
      .slice(-10)
      .map((m) => ({
        role: m.role,
        content: m.text,
      }));

    setMessages((prev) => [...prev, userMsg, assistantPlaceholder]);
    setInput('');
    setIsSending(true);
    scrollToBottom();

    try {
      const response = await apiFetchStream('/api/assistant', {
        method: 'POST',
        body: JSON.stringify({ messages: historyForApi }),
      });

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Não foi possível iniciar a leitura da resposta.');
      }

      const decoder = new TextDecoder();
      let sseBuffer = '';
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const events = sseBuffer.split(/\r?\n\r?\n/);
        sseBuffer = events.pop() ?? '';

        for (const eventChunk of events) {
          const lines = eventChunk.split(/\r?\n/);
          for (const line of lines) {
            if (!line.startsWith('data:')) continue;
            const payloadStr = line.slice(5).trim();
            if (!payloadStr || payloadStr === '[DONE]') continue;

            try {
              const parsed = JSON.parse(payloadStr) as {
                response?: string;
                choices?: Array<{ delta?: { content?: string } }>;
              };
              const tokenText =
                typeof parsed.response === 'string'
                  ? parsed.response
                  : typeof parsed.choices?.[0]?.delta?.content === 'string'
                    ? parsed.choices[0].delta.content
                    : '';

              if (tokenText) {
                accumulatedText += tokenText;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId ? { ...m, text: accumulatedText } : m
                  )
                );
                scrollToBottom();
              }
            } catch {
              // Ignore non-JSON heartbeat lines
            }
          }
        }
      }

      if (!accumulatedText.trim()) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  text: 'Não encontrei informações suficientes nos seus registros para responder.',
                }
              : m
          )
        );
      }
    } catch (err) {
      const errMsg =
        err instanceof Error
          ? err.message
          : 'Não foi possível consultar o assistente agora.';
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, text: errMsg } : m))
      );
    } finally {
      setIsSending(false);
      scrollToBottom();
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
            Respostas baseadas nos seus últimos 6 meses de gastos, top estabelecimentos e orçamentos.
          </p>
        </div>

        {messages.length > 0 && (
          <button
            type="button"
            disabled={isSending}
            onClick={() => setMessages([])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-[#1C2025] disabled:opacity-50 self-start sm:self-auto"
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
              Pergunte sobre gastos por mês, categorias, estabelecimentos ou limites de orçamento.
            </p>
          </div>
        ) : (
          messages.map((msg, idx) => {
            const isStreamingThis = isSending && idx === messages.length - 1 && msg.role === 'assistant';
            return (
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
                    className={`px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'rounded-2xl rounded-br-xs bg-slate-100 dark:bg-[#1E293B] text-slate-900 dark:text-white'
                        : 'rounded-2xl rounded-bl-xs border border-violet-200 dark:border-violet-500/30 bg-slate-50/60 dark:bg-[#101419] text-slate-800 dark:text-slate-100'
                    }`}
                  >
                    {msg.text ? (
                      <>
                        <span>{msg.text}</span>
                        {isStreamingThis && (
                          <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-violet-500 animate-pulse" />
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        Analisando seus lançamentos...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
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
              disabled={isSending}
              onClick={() => sendMessage(chip)}
              className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-[#222C38] bg-white dark:bg-[#151B23] hover:border-violet-400 disabled:opacity-50 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors whitespace-nowrap shrink-0"
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
