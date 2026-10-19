// Cliente REST mínimo da API Gemini (Google AI Studio): fetch com timeout, novas
// tentativas em falhas temporárias e erros tipados — sem SDK.
// Sem "server-only" de propósito: o seed da BNCC (tsx) também usa. A chave vem de
// GEMINI_API_KEY, que nunca chega ao navegador (não tem o prefixo NEXT_PUBLIC_).
// Os embeddings (busca por tema) são sempre do Gemini; a geração pode ser do Gemini ou do
// DeepSeek (ver llm.ts).
import { normalize } from "../bncc/vetores";
import { LlmError, abortableSleep, backoffMs } from "./llm-error";
import type { LlmUsage } from "./providers";

/** text-embedding-004 foi desligado em 14/01/2026; este é o substituto indicado pelo Google. */
export const GEMINI_EMBEDDING_MODEL = "gemini-embedding-2";
export const GEMINI_EMBEDDING_DIMENSIONS = 768;
/** Prefixo de BnccHabilidade.embeddingKey: só vetores do mesmo modelo e tamanho são comparáveis. */
export const EMBEDDING_KEY_PREFIX = `${GEMINI_EMBEDDING_MODEL}@${GEMINI_EMBEDDING_DIMENSIONS}:`;
/**
 * gemini-3.5-flash com raciocínio baixo gera um plano em ~4–5 s, com bom português.
 * Medido em 10/2026: gemini-3.8-flash levou 18–24 s; os modelos "lite" respondem em ~3 s, mas escrevem sem acentos.
 * (O gemini-2.5-flash não está mais disponível para contas novas.)
 */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";
export const DEFAULT_THINKING_LEVEL = "low";
export type ThinkingLevel = "low" | "medium" | "high";

const API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const EMBED_BATCH_LIMIT = 100;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const BLOCKED_FINISH_REASONS = new Set(["SAFETY", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "RECITATION"]);

// O erro é o mesmo das outras IAs; os nomes antigos continuam valendo (seed, testes).
export { LlmError as GeminiError, type LlmErrorKind as GeminiErrorKind } from "./llm-error";

export interface GeminiRequestOptions {
  /** Cancelamento externo (ex.: o professor fechou a janela ou a conexão caiu). */
  signal?: AbortSignal;
  /** Limite de cada tentativa. */
  timeoutMs?: number;
  maxRetries?: number;
  /** Se o Google pedir para esperar mais que isto, desiste na hora e devolve rate_limit. */
  maxRetryWaitMs?: number;
  /** Recebe os tokens gastos (para quem quer somar o consumo). */
  onUsage?: (usage: LlmUsage) => void;
}

export interface GenerateJsonParams {
  model: string;
  systemInstruction: string;
  prompt: string;
  /** JSON Schema da resposta (structured output). */
  schema: object;
  temperature?: number;
  maxOutputTokens?: number;
  /** Raciocínio antes da resposta (só Gemini 3+). Mais baixo = mais rápido. */
  thinkingLevel?: ThinkingLevel;
}

export interface GeminiClientConfig {
  apiKey?: string;
  fetch?: typeof fetch;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export function isGeminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}

/**
 * Quanto o modelo raciocina antes de responder (GEMINI_THINKING_LEVEL). Só os modelos
 * Gemini 3 em diante aceitam thinkingLevel; para os outros não enviamos nada.
 */
export function getThinkingLevel(model: string): ThinkingLevel | undefined {
  const major = Number(/^gemini-(\d+)/.exec(model)?.[1]);
  if (!(major >= 3)) return undefined;
  const nivel = process.env.GEMINI_THINKING_LEVEL?.trim().toLowerCase();
  return nivel === "low" || nivel === "medium" || nivel === "high" ? nivel : DEFAULT_THINKING_LEVEL;
}

// O gemini-embedding-2 não aceita task_type: a tarefa vai como prefixo do texto.
export function formatEmbeddingQuery(query: string): string {
  return `task: search result | query: ${query}`;
}

export function formatEmbeddingDocument(title: string | null | undefined, text: string): string {
  return `title: ${title?.trim() || "none"} | text: ${text}`;
}

interface ApiErrorInfo {
  message: string;
  reason?: string;
  retryDelayMs?: number;
}

/** Lê o corpo de erro padrão das APIs Google: { error: { message, status, details[] } }. */
async function readApiError(response: Response): Promise<ApiErrorInfo> {
  const fallback = `HTTP ${response.status}`;
  const retryAfterHeader = Number(response.headers.get("retry-after"));
  const headerDelay = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0 ? retryAfterHeader * 1000 : undefined;
  try {
    const body = (await response.json()) as {
      error?: { message?: string; details?: Array<{ "@type"?: string; retryDelay?: string; reason?: string }> };
    };
    const details = body.error?.details ?? [];
    const retryDelay = details.find((detail) => detail["@type"]?.endsWith("RetryInfo"))?.retryDelay;
    const seconds = retryDelay ? Number.parseFloat(retryDelay) : Number.NaN;
    return {
      message: body.error?.message || fallback,
      reason: details.find((detail) => detail.reason)?.reason,
      retryDelayMs: Number.isFinite(seconds) ? Math.ceil(seconds * 1000) : headerDelay,
    };
  } catch {
    return { message: fallback, retryDelayMs: headerDelay };
  }
}

function toGeminiError(status: number, info: ApiErrorInfo, model: string): LlmError {
  if (status === 429) return new LlmError("rate_limit", `Cota do Gemini esgotada: ${info.message}`, info.retryDelayMs);
  if (status === 400 && (info.reason === "API_KEY_INVALID" || /api key/i.test(info.message))) {
    return new LlmError("config", "GEMINI_API_KEY inválida.");
  }
  if (status === 401 || status === 403) return new LlmError("config", `Acesso negado pelo Gemini: ${info.message}`);
  if (status === 404) return new LlmError("config", `Modelo "${model}" não encontrado na API do Gemini.`);
  if (status === 400) return new LlmError("bad_request", `O Gemini recusou a requisição: ${info.message}`);
  return new LlmError("unavailable", `Gemini indisponível (${status}): ${info.message}`);
}

export function createGeminiClient(config: GeminiClientConfig = {}) {
  const fetchImpl = config.fetch ?? fetch;
  const sleep = config.sleep ?? abortableSleep;

  async function post(model: string, method: string, body: unknown, options: GeminiRequestOptions): Promise<unknown> {
    const apiKey = config.apiKey ?? process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) throw new LlmError("config", "GEMINI_API_KEY não está definida no .env.");

    const { signal, timeoutMs = 60_000, maxRetries = 2, maxRetryWaitMs = 10_000 } = options;

    for (let attempt = 0; ; attempt += 1) {
      const timeout = AbortSignal.timeout(timeoutMs);
      let response: Response;
      try {
        response = await fetchImpl(`${API_BASE_URL}/models/${model}:${method}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify(body),
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
      } catch (error) {
        if (signal?.aborted) throw new LlmError("aborted", "Requisição cancelada.", undefined, { cause: error });
        // Timeout não é repetido: quem está esperando já esperou o bastante.
        if (timeout.aborted) {
          throw new LlmError("timeout", `O Gemini não respondeu em ${timeoutMs / 1000} s.`, undefined, {
            cause: error,
          });
        }
        if (attempt >= maxRetries) {
          throw new LlmError("unavailable", "Falha de rede ao chamar o Gemini.", undefined, { cause: error });
        }
        await wait(backoffMs(attempt), signal);
        continue;
      }

      if (response.ok) {
        try {
          return await response.json();
        } catch (error) {
          if (signal?.aborted) throw new LlmError("aborted", "Requisição cancelada.", undefined, { cause: error });
          if (timeout.aborted) throw new LlmError("timeout", "O Gemini demorou demais para responder.");
          throw new LlmError("invalid_response", "O Gemini devolveu um corpo que não é JSON.", undefined, {
            cause: error,
          });
        }
      }

      const info = await readApiError(response);
      const error = toGeminiError(response.status, info, model);
      const delay = info.retryDelayMs ?? backoffMs(attempt);
      if (!RETRYABLE_STATUS.has(response.status) || attempt >= maxRetries || delay > maxRetryWaitMs) throw error;
      await wait(delay, signal);
    }
  }

  async function wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
    try {
      await sleep(ms, signal);
    } catch (error) {
      throw new LlmError("aborted", "Requisição cancelada.", undefined, { cause: error });
    }
  }

  /** Gera embeddings normalizados (um por texto, na mesma ordem). */
  async function embed(texts: readonly string[], options: GeminiRequestOptions = {}): Promise<Float32Array[]> {
    const vectors: Float32Array[] = [];
    for (let start = 0; start < texts.length; start += EMBED_BATCH_LIMIT) {
      const batch = texts.slice(start, start + EMBED_BATCH_LIMIT);
      const result = (await post(
        GEMINI_EMBEDDING_MODEL,
        "batchEmbedContents",
        {
          requests: batch.map((text) => ({
            model: `models/${GEMINI_EMBEDDING_MODEL}`,
            content: { parts: [{ text }] },
            outputDimensionality: GEMINI_EMBEDDING_DIMENSIONS,
          })),
        },
        { timeoutMs: 30_000, ...options },
      )) as { embeddings?: Array<{ values?: number[] }> };

      const embeddings = result.embeddings ?? [];
      if (embeddings.length !== batch.length) {
        throw new LlmError("invalid_response", `Esperava ${batch.length} embeddings, recebi ${embeddings.length}.`);
      }
      for (const embedding of embeddings) {
        if (embedding.values?.length !== GEMINI_EMBEDDING_DIMENSIONS) {
          throw new LlmError("invalid_response", `Embedding com ${embedding.values?.length ?? 0} dimensões.`);
        }
        vectors.push(normalize(embedding.values));
      }
    }
    return vectors;
  }

  /** Gera uma resposta JSON que segue `schema` e devolve o objeto já interpretado. */
  async function generateJson(params: GenerateJsonParams, options: GeminiRequestOptions = {}): Promise<unknown> {
    const result = (await post(
      params.model,
      "generateContent",
      {
        systemInstruction: { parts: [{ text: params.systemInstruction }] },
        contents: [{ role: "user", parts: [{ text: params.prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseJsonSchema: params.schema,
          temperature: params.temperature ?? 0.4,
          maxOutputTokens: params.maxOutputTokens ?? 8192,
          ...(params.thinkingLevel ? { thinkingConfig: { thinkingLevel: params.thinkingLevel } } : {}),
        },
      },
      options,
    )) as {
      promptFeedback?: { blockReason?: string };
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; thoughtsTokenCount?: number };
      candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: string; thought?: boolean }> } }>;
    };

    const usage = result.usageMetadata;
    if (usage) {
      options.onUsage?.({
        entrada: usage.promptTokenCount ?? 0,
        saida: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
      });
    }
    if (result.promptFeedback?.blockReason) {
      throw new LlmError("blocked", `Pedido bloqueado pelo Gemini (${result.promptFeedback.blockReason}).`);
    }
    const candidate = result.candidates?.[0];
    const finishReason = candidate?.finishReason ?? "";
    if (BLOCKED_FINISH_REASONS.has(finishReason)) {
      throw new LlmError("blocked", `Resposta bloqueada pelo Gemini (${finishReason}).`);
    }
    if (finishReason === "MAX_TOKENS") {
      throw new LlmError("invalid_response", "A resposta do Gemini foi cortada por excesso de tamanho.");
    }

    const text = (candidate?.content?.parts ?? [])
      .filter((part) => !part.thought)
      .map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) throw new LlmError("invalid_response", "O Gemini devolveu uma resposta vazia.");

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new LlmError("invalid_response", "A resposta do Gemini não é um JSON válido.", undefined, {
        cause: error,
      });
    }
  }

  return { embed, generateJson };
}

export type GeminiClient = ReturnType<typeof createGeminiClient>;

/** Cliente padrão, com a chave do .env. */
export const gemini = createGeminiClient();
