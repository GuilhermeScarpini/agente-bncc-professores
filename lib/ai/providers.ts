// As IAs que podem gerar planos e provas. Sem dependências: a validação dos pedidos (que também
// roda no navegador) usa esta lista sem carregar os clientes das IAs.
export const LLM_PROVIDERS = ["gemini", "deepseek"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

/** Modelos do DeepSeek que o professor pode escolher nas páginas. */
export const DEEPSEEK_MODELS = ["deepseek-flash", "deepseek-v4-pro"] as const;
export type DeepSeekModel = (typeof DEEPSEEK_MODELS)[number];
/** O flash custa uma fração do pro e dá conta de questões curtas do Fundamental I. */
export const DEFAULT_DEEPSEEK_MODEL: DeepSeekModel = "deepseek-flash";

/** Tokens de uma chamada à IA (a saída inclui o raciocínio, que também é cobrado). */
export interface LlmUsage {
  entrada: number;
  saida: number;
}

export function isLlmProvider(value: unknown): value is LlmProvider {
  return typeof value === "string" && (LLM_PROVIDERS as readonly string[]).includes(value);
}
