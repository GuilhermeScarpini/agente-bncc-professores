// Cliente REST mínimo da API do DeepSeek (formato de chat da OpenAI): mesmo contrato do
// generateJson do Gemini, para a geração poder usar qualquer uma das duas IAs (ver llm.ts).
// Sem "server-only", como o gemini.ts. A chave vem de DEEPSEEK_API_KEY (nunca vai ao navegador).
import { LlmError, abortableSleep, backoffMs } from "./llm-error";
import { DEEPSEEK_MODELS, DEFAULT_DEEPSEEK_MODEL, type LlmUsage } from "./providers";

export { DEEPSEEK_MODELS, DEFAULT_DEEPSEEK_MODEL };
/** Quanto o modelo raciocina antes de responder: "low" é bem mais rápido e barato que o padrão ("high"). */
export const DEFAULT_DEEPSEEK_EFFORT = "low";
export type DeepSeekEffort = "low" | "high" | "max";

const API_URL = "https://api.deepseek.com/chat/completions";
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);

export interface DeepSeekGenerateParams {
  model: string;
  systemInstruction: string;
  prompt: string;
  /** JSON Schema da resposta: o DeepSeek não o impõe (só garante JSON), então ele vai nas instruções. */
  schema: object;
  temperature?: number;
  maxOutputTokens?: number;
  effort?: DeepSeekEffort;
}

export interface DeepSeekRequestOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  maxRetries?: number;
  /** Se a API pedir para esperar mais que isto, desiste na hora e devolve rate_limit. */
  maxRetryWaitMs?: number;
  /** Recebe os tokens gastos (para quem quer somar o consumo). */
  onUsage?: (usage: LlmUsage) => void;
}

export interface DeepSeekClientConfig {
  apiKey?: string;
  fetch?: typeof fetch;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
}

export function isDeepSeekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY?.trim());
}

export function getDeepSeekEffort(): DeepSeekEffort {
  const effort = process.env.DEEPSEEK_EFFORT?.trim().toLowerCase();
  return effort === "low" || effort === "high" || effort === "max" ? effort : DEFAULT_DEEPSEEK_EFFORT;
}

/** As instruções, o formato JSON esperado (o modo JSON do DeepSeek pede a palavra "JSON" no prompt). */
export function withSchemaInstruction(systemInstruction: string, schema: object): string {
  return `${systemInstruction}\n\nResponda SOMENTE com um objeto JSON válido, sem texto antes ou depois, seguindo exatamente este JSON Schema:\n${JSON.stringify(schema)}`;
}

async function readError(response: Response): Promise<{ message: string; retryAfterMs?: number }> {
  const retryAfter = Number(response.headers.get("retry-after"));
  const retryAfterMs = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined;
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return { message: body.error?.message || `HTTP ${response.status}`, retryAfterMs };
  } catch {
    return { message: `HTTP ${response.status}`, retryAfterMs };
  }
}

function toError(status: number, message: string, model: string, retryAfterMs?: number): LlmError {
  if (status === 401) return new LlmError("config", "DEEPSEEK_API_KEY inválida.");
  if (status === 402) return new LlmError("no_credit", `Saldo do DeepSeek esgotado: ${message}`);
  if (status === 429) return new LlmError("rate_limit", `Excesso de pedidos ao DeepSeek: ${message}`, retryAfterMs);
  if (status === 404 || (status === 400 && /model/i.test(message))) {
    return new LlmError("config", `Modelo "${model}" não encontrado na API do DeepSeek.`);
  }
  if (status === 400 || status === 422) return new LlmError("bad_request", `O DeepSeek recusou a requisição: ${message}`);
  return new LlmError("unavailable", `DeepSeek indisponível (${status}): ${message}`);
}

export function createDeepSeekClient(config: DeepSeekClientConfig = {}) {
  const fetchImpl = config.fetch ?? fetch;
  const sleep = config.sleep ?? abortableSleep;

  async function wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
    try {
      await sleep(ms, signal);
    } catch (error) {
      throw new LlmError("aborted", "Requisição cancelada.", undefined, { cause: error });
    }
  }

  /** Gera uma resposta JSON e devolve o objeto já interpretado (quem chama confere o formato). */
  async function generateJson(params: DeepSeekGenerateParams, options: DeepSeekRequestOptions = {}): Promise<unknown> {
    const apiKey = config.apiKey ?? process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) throw new LlmError("config", "DEEPSEEK_API_KEY não está definida no .env.");
    const { signal, timeoutMs = 90_000, maxRetries = 2, maxRetryWaitMs = 10_000 } = options;

    const body = JSON.stringify({
      model: params.model,
      messages: [
        { role: "system", content: withSchemaInstruction(params.systemInstruction, params.schema) },
        { role: "user", content: params.prompt },
      ],
      response_format: { type: "json_object" },
      temperature: params.temperature ?? 0.4,
      max_tokens: params.maxOutputTokens ?? 8192,
      reasoning_effort: params.effort ?? getDeepSeekEffort(),
    });

    for (let attempt = 0; ; attempt += 1) {
      const timeout = AbortSignal.timeout(timeoutMs);
      let response: Response;
      try {
        response = await fetchImpl(API_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body,
          signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
      } catch (error) {
        if (signal?.aborted) throw new LlmError("aborted", "Requisição cancelada.", undefined, { cause: error });
        if (timeout.aborted) {
          throw new LlmError("timeout", `O DeepSeek não respondeu em ${timeoutMs / 1000} s.`, undefined, { cause: error });
        }
        if (attempt >= maxRetries) {
          throw new LlmError("unavailable", "Falha de rede ao chamar o DeepSeek.", undefined, { cause: error });
        }
        await wait(backoffMs(attempt), signal);
        continue;
      }

      if (!response.ok) {
        const info = await readError(response);
        const error = toError(response.status, info.message, params.model, info.retryAfterMs);
        const delay = info.retryAfterMs ?? backoffMs(attempt);
        if (!RETRYABLE_STATUS.has(response.status) || attempt >= maxRetries || delay > maxRetryWaitMs) throw error;
        await wait(delay, signal);
        continue;
      }

      let result: {
        choices?: Array<{ finish_reason?: string; message?: { content?: string | null } }>;
        usage?: { prompt_tokens?: number; completion_tokens?: number };
      };
      try {
        result = (await response.json()) as typeof result;
      } catch (error) {
        if (signal?.aborted) throw new LlmError("aborted", "Requisição cancelada.", undefined, { cause: error });
        if (timeout.aborted) throw new LlmError("timeout", "O DeepSeek demorou demais para responder.");
        throw new LlmError("invalid_response", "O DeepSeek devolveu um corpo que não é JSON.", undefined, { cause: error });
      }

      if (result.usage) {
        options.onUsage?.({ entrada: result.usage.prompt_tokens ?? 0, saida: result.usage.completion_tokens ?? 0 });
      }
      const choice = result.choices?.[0];
      if (choice?.finish_reason === "content_filter") throw new LlmError("blocked", "Resposta bloqueada pelo DeepSeek.");
      if (choice?.finish_reason === "length") {
        throw new LlmError("invalid_response", "A resposta do DeepSeek foi cortada por excesso de tamanho.");
      }
      const text = choice?.message?.content?.trim();
      if (!text) throw new LlmError("invalid_response", "O DeepSeek devolveu uma resposta vazia.");
      try {
        return JSON.parse(text);
      } catch (error) {
        throw new LlmError("invalid_response", "A resposta do DeepSeek não é um JSON válido.", undefined, { cause: error });
      }
    }
  }

  return { generateJson };
}

/** Cliente padrão, com a chave do .env. */
export const deepseek = createDeepSeekClient();
