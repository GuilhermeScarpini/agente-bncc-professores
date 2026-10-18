// Formato do plano de aula devolvido pelo agente (contrato da API v1) e a versão em
// texto simples. Sem dependências de servidor.

/** Habilidade oficial recuperada da base (texto literal da BNCC). */
export interface HabilidadeConsultada {
  codigo: string;
  descricao: string;
  etapa: string;
  anoFaixa: string;
  componente: string;
  unidadeTematica: string | null;
  objetoConhecimento: string | null;
  /** Similaridade de cosseno com o tema (0 a 1). */
  similaridade: number;
}

export interface HabilidadeDoPlano extends HabilidadeConsultada {
  justificativa: string;
}

export interface EtapaMetodologia {
  titulo: string;
  duracao: string;
  descricao: string;
}

export interface InstrumentoAvaliacao {
  instrumento: string;
  descricao: string;
}

/** Cabeçalho formal do plano, com o que o professor escolheu (null quando não informado). */
export interface IdentificacaoPlano {
  componente: string | null;
  ano: string | null;
  bimestre: string | null;
}

export interface PlanoAula {
  /** Habilidades escolhidas pelo professor na lista, ou recuperadas pela busca semântica do tema. */
  origem: "habilidade_escolhida" | "busca_semantica";
  identificacao: IdentificacaoPlano;
  /** O tema informado ou, quando as habilidades foram escolhidas, o texto oficial delas. */
  tema: string;
  /** Orientações livres do professor (turma, recursos, tempo, adaptações). */
  complemento: string | null;
  titulo: string;
  duracao: string;
  /** Só códigos que vieram da base — nunca inventados pelo modelo. */
  habilidades: HabilidadeDoPlano[];
  objetivos: string[];
  metodologia: EtapaMetodologia[];
  avaliacao: InstrumentoAvaliacao[];
  /** Preenchido quando as habilidades encontradas não cobrem bem o tema. */
  aviso: string | null;
  /** Texto curto para compartilhar com a turma (sem códigos BNCC). */
  resumoParaFeed: string;
  /** Todas as habilidades consultadas na BNCC para montar o plano. */
  consultadas: HabilidadeConsultada[];
}

/** Resposta de POST /api/v1/planos: o plano e a versão pronta para copiar. */
export interface PlanoGerado extends PlanoAula {
  texto: string;
}

export const AVISO_IA = "Plano gerado com apoio de IA a partir da BNCC. Revise antes de usar com a turma.";

/** Versão completa em texto simples, para colar em documentos ou no diário de classe. */
export function formatarPlanoComoTexto(plano: PlanoAula): string {
  const linhas = [`PLANO DE AULA: ${plano.titulo}`];
  const { componente, ano, bimestre } = plano.identificacao;
  if (componente) linhas.push(`Componente curricular: ${componente}`);
  if (ano) linhas.push(`Ano: ${ano}`);
  if (bimestre) linhas.push(`Bimestre: ${bimestre}`);
  if (plano.origem === "busca_semantica") linhas.push(`Tema: ${plano.tema}`);
  if (plano.duracao) linhas.push(`Duração sugerida: ${plano.duracao}`);
  if (plano.complemento) linhas.push(`Orientações do professor: ${plano.complemento}`);

  linhas.push("", plano.habilidades.length === 1 ? "HABILIDADE DA BNCC" : "HABILIDADES DA BNCC");
  const rotuloJustificativa = plano.origem === "habilidade_escolhida" ? "Como a aula desenvolve" : "Por que";
  for (const habilidade of plano.habilidades) {
    linhas.push(`• ${habilidade.codigo} (${habilidade.componente}, ${habilidade.anoFaixa}): ${habilidade.descricao}`);
    if (habilidade.justificativa) linhas.push(`  ${rotuloJustificativa}: ${habilidade.justificativa}`);
  }

  linhas.push("", "OBJETIVOS DE APRENDIZAGEM", ...plano.objetivos.map((objetivo) => `• ${objetivo}`));

  linhas.push("", "METODOLOGIA");
  plano.metodologia.forEach((etapa, index) => {
    const duracao = etapa.duracao ? ` (${etapa.duracao})` : "";
    linhas.push(`${index + 1}. ${etapa.titulo}${duracao}: ${etapa.descricao}`);
  });

  linhas.push("", "AVALIAÇÃO FORMATIVA");
  for (const item of plano.avaliacao) linhas.push(`• ${item.instrumento}: ${item.descricao}`);

  if (plano.aviso) linhas.push("", `Atenção: ${plano.aviso}`);
  linhas.push("", AVISO_IA);
  return linhas.join("\n");
}
