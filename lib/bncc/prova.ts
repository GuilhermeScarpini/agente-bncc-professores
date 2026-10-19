// Formato da prova devolvida pelo agente (contrato da API v1) e as versões em texto:
// a prova para os estudantes (sem respostas) e o gabarito para o professor. Sem dependências de servidor.
import type { HabilidadeConsultada, IdentificacaoPlano } from "./plano";

export const FORMATOS_PROVA = ["mista", "objetivas", "discursivas"] as const;
export type FormatoProva = (typeof FORMATOS_PROVA)[number];

export const ROTULOS_FORMATO: Record<FormatoProva, string> = {
  mista: "Mista (objetivas e discursivas)",
  objetivas: "Só objetivas (múltipla escolha)",
  discursivas: "Só discursivas",
};

export const QUESTOES = { minimo: 3, maximo: 20, padrao: 10 } as const;

export const LETRAS = ["A", "B", "C", "D"] as const;

export interface Alternativa {
  letra: (typeof LETRAS)[number];
  texto: string;
}

export interface QuestaoProva {
  numero: number;
  /** Código BNCC (da base) que a questão avalia. */
  habilidade: string;
  /** O que a questão avalia em poucas palavras ("Multiplicação por 2, 3, 4 e 5"), para agrupar relatórios. */
  topico: string;
  tipo: "multipla_escolha" | "discursiva";
  enunciado: string;
  /** Quatro alternativas (A a D) nas questões de múltipla escolha; vazio nas discursivas. */
  alternativas: Alternativa[];
  /** Letra correta (múltipla escolha) ou resposta esperada (discursiva). */
  resposta: string;
  /** O que a questão avalia e como corrigir. */
  criterios: string;
}

export interface ProvaAvaliacao {
  origem: "habilidade_escolhida" | "busca_semantica";
  identificacao: IdentificacaoPlano;
  tema: string;
  complemento: string | null;
  titulo: string;
  instrucoes: string[];
  questoes: QuestaoProva[];
  /** Habilidades avaliadas, com o texto oficial. */
  habilidades: HabilidadeConsultada[];
  /** Preenchido quando alguma habilidade ficou sem questão ou não cobre bem o tema. */
  aviso: string | null;
  consultadas: HabilidadeConsultada[];
}

/** Resposta de POST /api/v1/provas: a prova e as versões prontas para copiar. */
export interface ProvaGerada extends ProvaAvaliacao {
  /** Prova para os estudantes, sem respostas nem códigos. */
  textoProva: string;
  /** Gabarito e critérios de correção, para o professor. */
  textoGabarito: string;
  /** A IA e o modelo que geraram (ex.: deepseek / deepseek-flash). */
  ia: { provedor: string; modelo: string; tokens: { entrada: number; saida: number } };
}

export const AVISO_IA_PROVA = "Prova gerada com apoio de IA a partir da BNCC. Revise as questões e o gabarito antes de aplicar.";

function cabecalho(prova: ProvaAvaliacao): string[] {
  const { componente, ano, bimestre } = prova.identificacao;
  return [componente && `Componente curricular: ${componente}`, ano && `Ano: ${ano}`, bimestre && `Bimestre: ${bimestre}`].filter(
    (linha): linha is string => Boolean(linha),
  );
}

/** Prova para imprimir ou colar num documento: sem gabarito, sem códigos. */
export function formatarProvaComoTexto(prova: ProvaAvaliacao): string {
  const linhas = [prova.titulo.toUpperCase(), ...cabecalho(prova), "", "Nome: ____________________________________  Data: ___/___/______", ""];
  if (prova.instrucoes.length > 0) linhas.push("INSTRUÇÕES", ...prova.instrucoes.map((item) => `• ${item}`), "");

  for (const questao of prova.questoes) {
    linhas.push(`${questao.numero}. ${questao.enunciado}`);
    if (questao.tipo === "multipla_escolha") {
      for (const alternativa of questao.alternativas) linhas.push(`   (${alternativa.letra}) ${alternativa.texto}`);
    } else {
      linhas.push("   ______________________________________________", "   ______________________________________________", "   ______________________________________________");
    }
    linhas.push("");
  }
  return linhas.join("\n").trimEnd();
}

/** Gabarito com a habilidade de cada questão e os critérios de correção. */
export function formatarGabaritoComoTexto(prova: ProvaAvaliacao): string {
  const linhas = [`GABARITO: ${prova.titulo}`, ...cabecalho(prova), ""];
  for (const questao of prova.questoes) {
    const resposta = questao.tipo === "multipla_escolha" ? `(${questao.resposta})` : questao.resposta;
    linhas.push(`${questao.numero}. [${questao.habilidade}] ${resposta}`);
    if (questao.criterios) linhas.push(`   Critérios: ${questao.criterios}`);
  }
  linhas.push("", "HABILIDADES AVALIADAS");
  for (const habilidade of prova.habilidades) {
    linhas.push(`• ${habilidade.codigo} (${habilidade.componente}, ${habilidade.anoFaixa}): ${habilidade.descricao}`);
  }
  if (prova.aviso) linhas.push("", `Atenção: ${prova.aviso}`);
  linhas.push("", AVISO_IA_PROVA);
  return linhas.join("\n");
}
