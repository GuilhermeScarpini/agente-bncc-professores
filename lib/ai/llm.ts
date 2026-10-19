// Qual IA gera os planos e as provas: Gemini ou DeepSeek. O padrão vem de LLM_PROVIDER no .env;
// cada pedido pode escolher outra (`llm`) e outro modelo (`modelo`). Os embeddings da busca por
// tema continuam no Gemini (o DeepSeek não tem embeddings).
import {
  DEFAULT_DEEPSEEK_MODEL,
  deepseek,
  isDeepSeekConfigured,
  type DeepSeekRequestOptions,
} from "./deepseek";
import { DEFAULT_GEMINI_MODEL, gemini, getThinkingLevel, isGeminiConfigured, type GeminiRequestOptions } from "./gemini";
import { LlmError } from "./llm-error";
import { isLlmProvider, type LlmProvider } from "./providers";

export { LLM_PROVIDERS, isLlmProvider, type LlmProvider, type LlmUsage } from "./providers";

/** IA padrão (LLM_PROVIDER); sem a variável, o Gemini, como antes. */
export function getDefaultProvider(): LlmProvider {
  const provider = process.env.LLM_PROVIDER?.trim().toLowerCase();
  return isLlmProvider(provider) ? provider : "gemini";
}

export function isProviderConfigured(provider: LlmProvider): boolean {
  return provider === "deepseek" ? isDeepSeekConfigured() : isGeminiConfigured();
}

/** Modelo padrão de cada IA (GEMINI_MODEL / DEEPSEEK_MODEL). */
export function getDefaultModel(provider: LlmProvider): string {
  return provider === "deepseek"
    ? process.env.DEEPSEEK_MODEL?.trim() || DEFAULT_DEEPSEEK_MODEL
    : process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export interface LlmChoice {
  provider: LlmProvider;
  model: string;
}

/** A IA e o modelo de um pedido: o que ele pediu ou o padrão do agente. */
export function resolveLlm(requested: { llm?: LlmProvider; modelo?: string } = {}): LlmChoice {
  const provider = requested.llm ?? getDefaultProvider();
  return { provider, model: requested.modelo || getDefaultModel(provider) };
}

export interface LlmGenerateParams {
  systemInstruction: string;
  prompt: string;
  /** JSON Schema da resposta: o Gemini impõe; o DeepSeek recebe nas instruções. */
  schema: object;
  temperature?: number;
  maxOutputTokens?: number;
}

/** Gera um JSON com a IA escolhida (quem chama confere o formato com zod). */
export async function generateJson(
  choice: LlmChoice,
  params: LlmGenerateParams,
  options: GeminiRequestOptions & DeepSeekRequestOptions = {},
): Promise<unknown> {
  if (!isProviderConfigured(choice.provider)) {
    throw new LlmError(
      "config",
      choice.provider === "deepseek" ? "DEEPSEEK_API_KEY não está definida no .env." : "GEMINI_API_KEY não está definida no .env.",
    );
  }
  if (choice.provider === "deepseek") return deepseek.generateJson({ ...params, model: choice.model }, options);
  return gemini.generateJson({ ...params, model: choice.model, thinkingLevel: getThinkingLevel(choice.model) }, options);
}
