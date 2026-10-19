// As IAs que podem gerar planos e provas. Sem dependências: a validação dos pedidos (que também
// roda no navegador) usa esta lista sem carregar os clientes das IAs.
export const LLM_PROVIDERS = ["gemini", "deepseek"] as const;
export type LlmProvider = (typeof LLM_PROVIDERS)[number];

/** Tokens de uma chamada à IA (a saída inclui o raciocínio, que também é cobrado). */
export interface LlmUsage {
  entrada: number;
  saida: number;
}

export function isLlmProvider(value: unknown): value is LlmProvider {
  return typeof value === "string" && (LLM_PROVIDERS as readonly string[]).includes(value);
}
