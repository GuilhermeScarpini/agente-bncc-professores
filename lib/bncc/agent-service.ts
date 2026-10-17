import "server-only";
import { prisma } from "@/lib/db";
import {
  EMBEDDING_KEY_PREFIX,
  formatEmbeddingQuery,
  gemini,
  getGenerationModel,
  type GeminiRequestOptions,
} from "@/lib/ai/gemini";
import { findAnoEscolar } from "./codigos";
import { formatarPlanoComoTexto, type HabilidadeConsultada, type PlanoGerado } from "./plano";
import { SYSTEM_PROMPT, montarPlano, montarPromptUsuario, respostaPlanoSchema, schemaRespostaPlano } from "./prompt";
import { bytesToVector, topKBySimilarity } from "./vetores";

export type BnccAgentErrorKind = "base_vazia" | "sem_resultados" | "resposta_invalida";

export class BnccAgentError extends Error {
  constructor(
    readonly kind: BnccAgentErrorKind,
    message: string,
  ) {
    super(message);
    this.name = "BnccAgentError";
  }
}

export interface BuscaHabilidades {
  tema: string;
  componente?: string;
  /** Valor de ANOS_ESCOLARES (ex.: "ef-7", "em"). */
  anoEscolar?: string;
  limite?: number;
}

const HABILIDADES_NO_CONTEXTO = 5;

/** Só habilidades com embedding do modelo atual entram na busca. */
const comEmbeddingAtual = { embeddingKey: { startsWith: EMBEDDING_KEY_PREFIX } };

/**
 * Busca híbrida: filtros exatos (componente e ano) no SQLite e, entre as habilidades
 * que sobram, ordenação por similaridade de cosseno com o tema.
 */
async function buscarHabilidades(
  busca: BuscaHabilidades,
  options: GeminiRequestOptions = {},
): Promise<HabilidadeConsultada[]> {
  const ano = findAnoEscolar(busca.anoEscolar);
  const candidatas = await prisma.bnccHabilidade.findMany({
    where: {
      ...comEmbeddingAtual,
      ...(busca.componente ? { componente: busca.componente } : {}),
      // Faixas como "6º ao 9º ano" valem para qualquer ano dentro delas.
      ...(ano ? { anoInicio: { lte: ano.fim }, anoFim: { gte: ano.inicio } } : {}),
    },
    select: {
      id: true,
      descricao: true,
      etapa: true,
      anoFaixa: true,
      componente: true,
      unidadeTematica: true,
      objetoConhecimento: true,
      embedding: true,
    },
  });

  if (candidatas.length === 0) {
    // Consulta o banco antes de gastar cota da API com o embedding do tema.
    const total = await prisma.bnccHabilidade.count({ where: comEmbeddingAtual });
    throw total === 0
      ? new BnccAgentError("base_vazia", "A base da BNCC não foi carregada (rode npm run db:seed-bncc).")
      : new BnccAgentError("sem_resultados", "Nenhuma habilidade para os filtros escolhidos.");
  }

  const [consulta] = await gemini.embed([formatEmbeddingQuery(busca.tema)], options);
  const ranking = topKBySimilarity(
    consulta!,
    candidatas,
    (habilidade) => bytesToVector(habilidade.embedding!),
    busca.limite ?? HABILIDADES_NO_CONTEXTO,
  );

  return ranking.map(({ item: { id, embedding: _embedding, ...habilidade }, similarity }) => ({
    codigo: id,
    ...habilidade,
    similaridade: Math.round(similarity * 1000) / 1000,
  }));
}

/** Recupera as habilidades oficiais e gera um plano de aula ancorado nelas. */
async function gerarPlano(busca: BuscaHabilidades, options: { signal?: AbortSignal } = {}): Promise<PlanoGerado> {
  const consultadas = await buscarHabilidades(busca, { signal: options.signal, timeoutMs: 20_000 });

  const resposta = await gemini.generateJson(
    {
      model: getGenerationModel(),
      systemInstruction: SYSTEM_PROMPT,
      prompt: montarPromptUsuario({
        tema: busca.tema,
        componente: busca.componente,
        anoEscolar: findAnoEscolar(busca.anoEscolar)?.label,
        habilidades: consultadas,
      }),
      schema: schemaRespostaPlano(consultadas.map((habilidade) => habilidade.codigo)),
    },
    { signal: options.signal, timeoutMs: 75_000, maxRetryWaitMs: 5_000 },
  );

  const parsed = respostaPlanoSchema.safeParse(resposta);
  if (!parsed.success) {
    throw new BnccAgentError("resposta_invalida", `Resposta fora do formato: ${parsed.error.issues[0]?.message}`);
  }
  const plano = montarPlano(busca.tema, parsed.data, consultadas);
  return { ...plano, texto: formatarPlanoComoTexto(plano) };
}

export const bnccAgentService = { buscarHabilidades, gerarPlano };
