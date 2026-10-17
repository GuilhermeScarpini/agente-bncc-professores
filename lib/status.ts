import "server-only";
import { prisma } from "@/lib/db";
import { EMBEDDING_KEY_PREFIX, GEMINI_EMBEDDING_MODEL, getGenerationModel, isGeminiConfigured } from "@/lib/ai/gemini";

export interface AgenteStatus {
  /** Pronto para gerar planos: chave do Gemini definida e BNCC carregada. */
  pronto: boolean;
  /** GEMINI_API_KEY definida. */
  configurado: boolean;
  /** Habilidades prontas para a busca (com embedding do modelo atual). */
  habilidades: number;
  modeloGeracao: string;
  modeloEmbedding: string;
}

export async function getAgenteStatus(): Promise<AgenteStatus> {
  const habilidades = await prisma.bnccHabilidade.count({
    where: { embeddingKey: { startsWith: EMBEDDING_KEY_PREFIX } },
  });
  const configurado = isGeminiConfigured();
  return {
    pronto: configurado && habilidades > 0,
    configurado,
    habilidades,
    modeloGeracao: getGenerationModel(),
    modeloEmbedding: GEMINI_EMBEDDING_MODEL,
  };
}
