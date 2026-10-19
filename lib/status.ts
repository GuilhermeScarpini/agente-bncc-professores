import "server-only";
import { prisma } from "@/lib/db";
import { EMBEDDING_KEY_PREFIX, GEMINI_EMBEDDING_MODEL, isGeminiConfigured } from "@/lib/ai/gemini";
import { LLM_PROVIDERS, getDefaultModel, getDefaultProvider, isProviderConfigured, type LlmProvider } from "@/lib/ai/llm";

export interface AgenteStatus {
  /** Pronto para gerar: a IA padrão configurada e a BNCC carregada. */
  pronto: boolean;
  /** A IA padrão tem chave definida. */
  configurado: boolean;
  /** Habilidades prontas para a busca (com embedding do modelo atual). */
  habilidades: number;
  /** IA que gera quando o pedido não escolhe outra (LLM_PROVIDER). */
  provedorGeracao: LlmProvider;
  modeloGeracao: string;
  /** Cada IA e se tem chave; um pedido pode escolher qualquer uma configurada (`llm`). */
  provedores: Record<LlmProvider, { configurado: boolean; modeloPadrao: string }>;
  /** A busca por tema usa embeddings do Gemini (precisa de GEMINI_API_KEY). */
  modeloEmbedding: string;
  buscaPorTema: boolean;
}

export async function getAgenteStatus(): Promise<AgenteStatus> {
  const habilidades = await prisma.bnccHabilidade.count({
    where: { embeddingKey: { startsWith: EMBEDDING_KEY_PREFIX } },
  });
  const provedorGeracao = getDefaultProvider();
  const configurado = isProviderConfigured(provedorGeracao);
  return {
    pronto: configurado && habilidades > 0,
    configurado,
    habilidades,
    provedorGeracao,
    modeloGeracao: getDefaultModel(provedorGeracao),
    provedores: Object.fromEntries(
      LLM_PROVIDERS.map((provider) => [provider, { configurado: isProviderConfigured(provider), modeloPadrao: getDefaultModel(provider) }]),
    ) as AgenteStatus["provedores"],
    modeloEmbedding: GEMINI_EMBEDDING_MODEL,
    buscaPorTema: isGeminiConfigured(),
  };
}
