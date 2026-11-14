import { Hono } from 'hono';
import { z } from 'zod';
import { getSupabaseClient, incrementDailyAiUsage } from '../lib/supabase';
import type { AppContextEnv } from '../types';
import { addDaysISO, getTodaySaoPauloISO, isValidISODate } from './expenses';

const MAX_IMAGE_DATA_URL_BYTES = Math.floor(1.5 * 1024 * 1024); // 1.5 MB
const MAX_TEXT_LENGTH = 500;
const MAX_AUDIO_BASE64_BYTES = 2 * 1024 * 1024; // 2 MB

const extractRequestSchema = z.object({
  kind: z.enum(['image', 'text', 'audio'], {
    message: 'Tipo de entrada inválido. Use image, text ou audio.',
  }),
  data: z.string({ message: 'Conteúdo obrigatório.' }).min(1, 'Conteúdo não pode estar vazio.'),
});

function clampConfidence(val: unknown): number {
  const num = typeof val === 'number' ? val : Number(val);
  if (!Number.isFinite(num)) return 0.5;
  if (num > 1 && num <= 100) return Math.min(1, Math.max(0, num / 100));
  return Math.min(1, Math.max(0, num));
}

function parseFlexibleAmount(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    return Number.isFinite(val) && val >= 0 ? val : null;
  }
  if (typeof val === 'string') {
    let cleaned = val.trim().replace(/[^\d.,-]/g, '');
    if (!cleaned) return null;
    if (cleaned.includes(',') && cleaned.includes('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else if (cleaned.includes(',')) {
      cleaned = cleaned.replace(',', '.');
    }
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
  }
  return null;
}

const aiJsonSchema = z.object({
  is_expense: z.boolean(),
  merchant: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v.slice(0, 120) : null)),
  amount: z.preprocess(parseFlexibleAmount, z.number().nonnegative().nullable()),
  date: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  category: z.string().trim().min(1),
  subcategory: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v.slice(0, 80) : null)),
  payment_method: z
    .enum(['pix', 'credito', 'debito', 'dinheiro', 'outro'])
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  description: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v && v.length > 0 ? v.slice(0, 500) : null)),
  confidence: z
    .object({
      merchant: z.preprocess(clampConfidence, z.number().min(0).max(1)).default(0.5),
      amount: z.preprocess(clampConfidence, z.number().min(0).max(1)).default(0.5),
      date: z.preprocess(clampConfidence, z.number().min(0).max(1)).default(0.5),
      category: z.preprocess(clampConfidence, z.number().min(0).max(1)).default(0.5),
    })
    .default({ merchant: 0.5, amount: 0.5, date: 0.5, category: 0.5 }),
});

type ParsedAiResult = z.infer<typeof aiJsonSchema>;

function extractFirstJsonObject(rawText: string): string | null {
  const withoutFences = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```/g, '')
    .trim();

  const start = withoutFences.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < withoutFences.length; i++) {
    const ch = withoutFences[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          return withoutFences.slice(start, i + 1);
        }
      }
    }
  }

  return null;
}

function tryParseAndValidate(rawResponse: string): ParsedAiResult | null {
  const jsonStr = extractFirstJsonObject(rawResponse);
  if (!jsonStr) return null;
  try {
    const parsedJson = JSON.parse(jsonStr) as unknown;
    const validated = aiJsonSchema.safeParse(parsedJson);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

function normalizeLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isAiQuotaError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
  return (
    msg.includes('quota') ||
    msg.includes('rate limit') ||
    msg.includes('too many requests') ||
    msg.includes('limit exceeded') ||
    msg.includes('429') ||
    msg.includes('daily limit') ||
    msg.includes('neurons')
  );
}

function buildSystemPrompt(todayISO: string, categoryNames: string[]): string {
  const categoriesList = categoryNames.join(', ');
  return [
    'Você é um extrator preciso de despesas pessoais brasileiras.',
    `Data de hoje (fuso America/Sao_Paulo): ${todayISO}.`,
    `Lista de categorias do usuário: [${categoriesList}].`,
    'Responda SOMENTE com um JSON válido exatamente neste formato:',
    '{ "is_expense": boolean, "merchant": string|null, "amount": number|null, "date": "AAAA-MM-DD"|null, "category": string, "subcategory": string|null, "payment_method": "pix"|"credito"|"debito"|"dinheiro"|"outro"|null, "description": string|null, "confidence": { "merchant": 0-1, "amount": 0-1, "date": 0-1, "category": 0-1 } }',
    'Regras obrigatórias:',
    '- Valores no formato brasileiro viram número decimal com ponto (ex: "1.234,56" -> 1234.56).',
    '- Em cupons fiscais, priorize "TOTAL", "VALOR A PAGAR" ou "VALOR PAGO", nunca subtotais, descontos ou troco.',
    '- Datas no formato dd/mm/aaaa viram AAAA-MM-DD.',
    `- Termos relativos como "hoje", "ontem" e "anteontem" são relativos à data de hoje (${todayISO}).`,
    '- Se não houver data informada ou legível, use null em "date".',
    `- "category" precisa ser EXATAMENTE um dos nomes da lista [${categoriesList}]. Em caso de dúvida, use "Outros".`,
    '- Em comprovantes Pix, use "payment_method": "pix".',
    '- Se a imagem ou texto NÃO representar uma despesa, pagamento ou compra, retorne "is_expense": false.',
    '- Os campos de "confidence" devem ser números entre 0 e 1 indicando sua confiança na extração de cada campo.',
    '- Não escreva explicações, saudações ou texto fora do JSON.',
  ].join('\n');
}

export const aiRoutes = new Hono<AppContextEnv>();

aiRoutes.post('/ai/extract', async (c) => {
  const userId = c.get('userId');
  const supabase = getSupabaseClient(c);

  let rawBody: unknown;
  try {
    rawBody = await c.req.json();
  } catch {
    return c.json({ error: 'Corpo da requisição inválido.' }, 400);
  }

  const parsedReq = extractRequestSchema.safeParse(rawBody);
  if (!parsedReq.success) {
    const msg = parsedReq.error.issues[0]?.message || 'Dados inválidos.';
    return c.json({ error: msg }, 400);
  }

  const { kind, data } = parsedReq.data;

  if (kind === 'image') {
    if (data.length > MAX_IMAGE_DATA_URL_BYTES) {
      return c.json({ error: 'A imagem comprimida excede o limite de 1,5 MB.' }, 413);
    }
    if (!/^data:image\/(jpeg|jpg|png|webp|heic|heif);base64,[A-Za-z0-9+/=]+$/i.test(data)) {
      return c.json({ error: 'Formato de imagem inválido. Envie JPEG, PNG ou WEBP.' }, 400);
    }
  } else if (kind === 'text') {
    const trimmed = data.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_TEXT_LENGTH) {
      return c.json(
        { error: `O texto deve ter entre 1 e ${MAX_TEXT_LENGTH} caracteres.` },
        400
      );
    }
  } else if (kind === 'audio') {
    const cleanAudio = data.replace(/^data:audio\/[^;]+;base64,/i, '').trim();
    if (!cleanAudio || cleanAudio.length > MAX_AUDIO_BASE64_BYTES) {
      return c.json({ error: 'O áudio excede o limite de 2 MB ou está vazio.' }, 413);
    }
  }

  const todayISO = getTodaySaoPauloISO();
  const dailyLimit = Number.parseInt(c.env.AI_DAILY_LIMIT_PER_USER || '60', 10) || 60;

  try {
    const callsToday = await incrementDailyAiUsage(supabase, userId, todayISO);
    if (callsToday > dailyLimit) {
      return c.json(
        {
          error:
            'Você atingiu o limite diário de leituras por IA. Registre manualmente ou tente amanhã.',
        },
        429
      );
    }
  } catch (err) {
    console.error('[AI Usage Quota Error]', err instanceof Error ? err.message : 'Quota check failed');
    return c.json({ error: 'Não foi possível validar o uso de IA.' }, 500);
  }

  const { data: catRows, error: catErr } = await supabase
    .from('categories')
    .select('id, name, color, icon')
    .eq('user_id', userId)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })
    .returns<Array<{ id: string; name: string; color: string; icon: string }>>();

  if (catErr) {
    console.error('[AI Categories Fetch Error]', catErr.code);
  }

  const userCategories = catRows ?? [];
  const categoryNames = userCategories.length > 0 ? userCategories.map((cat) => cat.name) : ['Outros'];

  const gatewayConfig = c.env.AI_GATEWAY_ID?.trim()
    ? { gateway: { id: c.env.AI_GATEWAY_ID.trim() } }
    : undefined;

  let transcript: string | null = null;
  let textToAnalyze = kind === 'text' ? data.trim() : '';

  try {
    if (kind === 'audio') {
      const cleanAudioBase64 = data.replace(/^data:audio\/[^;]+;base64,/i, '').trim();
      const whisperOutput = await c.env.AI.run(
        '@cf/openai/whisper-large-v3-turbo',
        {
          audio: cleanAudioBase64,
          language: 'pt',
        },
        gatewayConfig
      );

      transcript = whisperOutput.text?.trim() || null;
      if (!transcript) {
        return c.json(
          { error: 'Não consegui ler esta despesa. Tente outra foto ou digite manualmente.' },
          422
        );
      }
      textToAnalyze = transcript;
    }

    const systemPrompt = buildSystemPrompt(todayISO, categoryNames);
    const userMessageContent =
      kind === 'image'
        ? [
            {
              type: 'text',
              text: 'Analise esta imagem de comprovante/cupom e extraia os dados da despesa em JSON.',
            },
            {
              type: 'image_url',
              image_url: { url: data },
            },
          ]
        : textToAnalyze;

    const baseMessages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessageContent },
    ];

    const firstRun = await c.env.AI.run(
      '@cf/meta/llama-4-scout-17b-16e-instruct',
      {
        messages: baseMessages,
        max_tokens: 600,
        temperature: 0.1,
      },
      gatewayConfig
    );

    const firstText = typeof firstRun.response === 'string' ? firstRun.response : '';
    let parsedAi = tryParseAndValidate(firstText);

    if (!parsedAi) {
      const retryRun = await c.env.AI.run(
        '@cf/meta/llama-4-scout-17b-16e-instruct',
        {
          messages: [
            ...baseMessages,
            { role: 'assistant', content: firstText || '{}' },
            { role: 'user', content: 'Responda apenas com o JSON' },
          ],
          max_tokens: 600,
          temperature: 0.1,
        },
        gatewayConfig
      );
      const retryText = typeof retryRun.response === 'string' ? retryRun.response : '';
      parsedAi = tryParseAndValidate(retryText);
    }

    if (!parsedAi || !parsedAi.is_expense) {
      return c.json(
        { error: 'Não consegui ler esta despesa. Tente outra foto ou digite manualmente.' },
        422
      );
    }

    const maxAllowedDate = addDaysISO(todayISO, 1);
    const validDate =
      parsedAi.date && isValidISODate(parsedAi.date) && parsedAi.date <= maxAllowedDate
        ? parsedAi.date
        : null;

    const amountCents =
      parsedAi.amount !== null && parsedAi.amount > 0 && parsedAi.amount <= 1_000_000
        ? Math.round(parsedAi.amount * 100)
        : null;

    const normalizedTarget = normalizeLabel(parsedAi.category);
    const matchedCategory =
      userCategories.find((cat) => normalizeLabel(cat.name) === normalizedTarget) ??
      userCategories.find((cat) => normalizeLabel(cat.name) === 'outros') ??
      userCategories[0];

    return c.json({
      suggestion: {
        merchant: parsedAi.merchant,
        amountCents,
        expenseDate: validDate,
        categoryId: matchedCategory?.id ?? '',
        categoryName: matchedCategory?.name ?? 'Outros',
        subcategory: parsedAi.subcategory,
        paymentMethod: parsedAi.payment_method,
        description: parsedAi.description,
        confidence: parsedAi.confidence,
      },
      transcript,
    });
  } catch (err) {
    console.error(
      '[AI Extract Error]',
      kind,
      err instanceof Error ? err.message : 'AI extraction failed'
    );
    if (isAiQuotaError(err)) {
      return c.json(
        { error: 'A IA atingiu o limite gratuito de hoje. Registre manualmente por enquanto.' },
        503
      );
    }
    return c.json(
      { error: 'Não consegui ler esta despesa. Tente outra foto ou digite manualmente.' },
      422
    );
  }
});
