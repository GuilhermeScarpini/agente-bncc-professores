import "server-only";
import { prisma } from "@/lib/db";
import { EMBEDDING_KEY_PREFIX, formatEmbeddingQuery, gemini, type GeminiRequestOptions } from "@/lib/ai/gemini";
import { generateJson, resolveLlm, type LlmProvider, type LlmUsage } from "@/lib/ai/llm";
import { rotuloBimestre, type Bimestre } from "./bimestres";
import { findAnoEscolar } from "./codigos";
import { formatarPlanoComoTexto, type HabilidadeConsultada, type PlanoGerado } from "./plano";
import { SYSTEM_PROMPT, montarPlano, montarPromptUsuario, respostaPlanoSchema, schemaRespostaPlano } from "./prompt";
import { SYSTEM_PROMPT_PROVA, montarPromptProva, montarProva, respostaProvaSchema, schemaRespostaProva } from "./prompt-prova";
import { formatarGabaritoComoTexto, formatarProvaComoTexto, type FormatoProva, type ProvaGerada } from "./prova";
import { bytesToVector, topKBySimilarity } from "./vetores";

export type BnccAgentErrorKind = "base_vazia" | "sem_resultados" | "habilidade_inexistente" | "resposta_invalida";

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

export interface PedidoPlano {
  /** Tema livre: as habilidades vêm da busca semântica. */
  tema?: string;
  /** Códigos escolhidos pelo professor na lista: dispensam o tema e a busca. */
  habilidades?: string[];
  /** Orientações livres do professor (turma, recursos, tempo, adaptações). */
  complemento?: string;
  componente?: string;
  anoEscolar?: string;
  bimestre?: Bimestre;
  /** IA que gera (sem ela, LLM_PROVIDER do .env) e o modelo (sem ele, o padrão da IA). */
  llm?: LlmProvider;
  modelo?: string;
}

export interface PedidoProva extends PedidoPlano {
  quantidade: number;
  formato: FormatoProva;
}

const HABILIDADES_NO_CONTEXTO = 5;

const camposDaHabilidade = {
  id: true,
  descricao: true,
  etapa: true,
  anoFaixa: true,
  componente: true,
  unidadeTematica: true,
  objetoConhecimento: true,
} as const;

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
    select: { ...camposDaHabilidade, embedding: true },
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

/** As habilidades escolhidas na lista, na ordem do pedido, com o texto oficial da base (sem chamar a API). */
async function buscarHabilidadesPorCodigo(codigos: readonly string[]): Promise<HabilidadeConsultada[]> {
  const registros = await prisma.bnccHabilidade.findMany({ where: { id: { in: [...codigos] } }, select: camposDaHabilidade });
  const porCodigo = new Map(registros.map(({ id, ...habilidade }) => [id, { codigo: id, ...habilidade, similaridade: 1 }]));
  const faltando = codigos.filter((codigo) => !porCodigo.has(codigo));
  if (faltando.length > 0) {
    throw new BnccAgentError(
      "habilidade_inexistente",
      `Habilidade(s) fora da base: ${faltando.join(", ")} (rode npm run db:seed-bncc).`,
    );
  }
  return codigos.map((codigo) => porCodigo.get(codigo)!);
}

/** O que planos e provas têm em comum: as habilidades (escolhidas ou buscadas) e o cabeçalho. */
async function prepararGeracao(pedido: PedidoPlano, signal: AbortSignal | undefined) {
  const escolhidas = Boolean(pedido.habilidades?.length);
  const consultadas = escolhidas
    ? await buscarHabilidadesPorCodigo(pedido.habilidades!)
    : await buscarHabilidades({ ...pedido, tema: pedido.tema ?? "" }, { signal, timeoutMs: 20_000 });
  const ano = findAnoEscolar(pedido.anoEscolar)?.label;
  const bimestre = pedido.bimestre ? rotuloBimestre(pedido.bimestre) : undefined;
  const llm = resolveLlm({ llm: pedido.llm, modelo: pedido.modelo });
  return {
    escolhidas,
    consultadas,
    tema: escolhidas ? consultadas.map((habilidade) => habilidade.descricao).join(" ") : (pedido.tema ?? ""),
    ano,
    bimestre,
    llm,
    contexto: {
      origem: escolhidas ? ("habilidade_escolhida" as const) : ("busca_semantica" as const),
      identificacao: {
        componente: pedido.componente ?? (escolhidas ? consultadas[0]!.componente : null),
        ano: ano ?? null,
        bimestre: bimestre ?? null,
      },
      complemento: pedido.complemento ?? null,
    },
  };
}

/** Soma os tokens de todas as chamadas de uma geração (o cliente pode repetir a chamada). */
function usageCounter() {
  const total: LlmUsage = { entrada: 0, saida: 0 };
  return {
    total,
    add: (usage: LlmUsage) => {
      total.entrada += usage.entrada;
      total.saida += usage.saida;
    },
  };
}

/** Recupera as habilidades oficiais e gera um plano de aula ancorado nelas. */
async function gerarPlano(pedido: PedidoPlano, options: { signal?: AbortSignal } = {}): Promise<PlanoGerado> {
  const { escolhidas, consultadas, tema, ano, bimestre, llm, contexto } = await prepararGeracao(pedido, options.signal);

  const usage = usageCounter();
  const resposta = await generateJson(
    llm,
    {
      systemInstruction: SYSTEM_PROMPT,
      prompt: montarPromptUsuario({
        tema: escolhidas ? undefined : tema,
        complemento: pedido.complemento,
        componente: pedido.componente,
        anoEscolar: ano,
        bimestre,
        habilidades: consultadas,
      }),
      schema: schemaRespostaPlano(
        consultadas.map((habilidade) => habilidade.codigo),
        { todas: escolhidas },
      ),
    },
    { signal: options.signal, timeoutMs: 75_000, maxRetryWaitMs: 5_000, onUsage: usage.add },
  );

  const parsed = respostaPlanoSchema.safeParse(resposta);
  if (!parsed.success) {
    throw new BnccAgentError("resposta_invalida", `Resposta fora do formato: ${parsed.error.issues[0]?.message}`);
  }
  const plano = montarPlano(tema, parsed.data, consultadas, contexto);
  return { ...plano, texto: formatarPlanoComoTexto(plano), ia: { provedor: llm.provider, modelo: llm.model, tokens: usage.total } };
}

/** Recupera as habilidades oficiais e gera uma prova com gabarito ancorada nelas. */
async function gerarProva(pedido: PedidoProva, options: { signal?: AbortSignal } = {}): Promise<ProvaGerada> {
  const { escolhidas, consultadas, tema, ano, bimestre, llm, contexto } = await prepararGeracao(pedido, options.signal);

  const usage = usageCounter();
  const resposta = await generateJson(
    llm,
    {
      systemInstruction: SYSTEM_PROMPT_PROVA,
      prompt: montarPromptProva({
        tema: escolhidas ? undefined : tema,
        complemento: pedido.complemento,
        componente: pedido.componente,
        anoEscolar: ano,
        bimestre,
        quantidade: pedido.quantidade,
        formato: pedido.formato,
        habilidades: consultadas,
      }),
      schema: schemaRespostaProva(
        consultadas.map((habilidade) => habilidade.codigo),
        { quantidade: pedido.quantidade, formato: pedido.formato },
      ),
      // 20 questões com alternativas e critérios passam de 8 mil tokens.
      maxOutputTokens: 16_384,
    },
    { signal: options.signal, timeoutMs: 90_000, maxRetryWaitMs: 5_000, onUsage: usage.add },
  );

  const parsed = respostaProvaSchema.safeParse(resposta);
  if (!parsed.success) {
    throw new BnccAgentError("resposta_invalida", `Resposta fora do formato: ${parsed.error.issues[0]?.message}`);
  }
  const prova = montarProva(parsed.data, consultadas, { ...contexto, tema });
  return {
    ...prova,
    textoProva: formatarProvaComoTexto(prova),
    textoGabarito: formatarGabaritoComoTexto(prova),
    ia: { provedor: llm.provider, modelo: llm.model, tokens: usage.total },
  };
}

export const bnccAgentService = { buscarHabilidades, buscarHabilidadesPorCodigo, gerarPlano, gerarProva };
