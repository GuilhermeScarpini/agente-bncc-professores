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
  /** Código BNCC (da base) que a questão avalia; vazio numa questão escrita à mão sem código. */
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

/** Questão em branco para "Adicionar questão". */
export function questaoEmBranco(): QuestaoProva {
  return {
    numero: 0,
    habilidade: "",
    topico: "",
    tipo: "multipla_escolha",
    enunciado: "",
    alternativas: LETRAS.map((letra) => ({ letra, texto: "" })),
    resposta: "",
    criterios: "",
  };
}

/** O que falta para a questão ficar completa (null quando está pronta para salvar). */
export function problemaDaQuestao(questao: QuestaoProva): string | null {
  if (!questao.enunciado.trim()) return "Escreva o enunciado da questão.";
  if (questao.tipo === "multipla_escolha") {
    if (questao.alternativas.length !== LETRAS.length || questao.alternativas.some((a) => !a.texto.trim())) {
      return "Preencha as quatro alternativas (A a D).";
    }
    if (!(LETRAS as readonly string[]).includes(questao.resposta)) return "Marque qual alternativa é a correta.";
  } else if (!questao.resposta.trim()) {
    return "Escreva a resposta esperada: ela vai no gabarito do professor.";
  }
  return null;
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

/** Imagem que o professor anexou a uma questão. Fica só no navegador, nunca vai ao servidor. */
export interface ImagemDaQuestao {
  /** data:image/… já reduzida no navegador. */
  src: string;
  largura: number;
  altura: number;
  /** Descrição para quem não enxerga (texto alternativo). */
  descricao: string;
}

/** Imagens por número da questão. */
export type ImagensDaProva = Readonly<Record<number, ImagemDaQuestao>>;

/** Largura máxima da imagem na folha (px a 96 dpi, ~12,7 cm): cabe na página com margem e não toma a questão toda. */
const LARGURA_NA_FOLHA = 480;

const ENTIDADES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (caractere) => ENTIDADES[caractere]!);
}

const comQuebras = (texto: string) => escapar(texto).replace(/\r?\n/g, "<br>");

function imagemComoHtml(imagem: ImagemDaQuestao): string {
  // Só data URLs de imagem: o HTML é colado em outros programas e impresso.
  if (!/^data:image\/(png|jpeg|webp|gif);base64,[a-z0-9+/=]+$/i.test(imagem.src)) return "";
  const largura = Math.min(LARGURA_NA_FOLHA, imagem.largura);
  const altura = Math.round((imagem.altura * largura) / imagem.largura);
  return `<p><img src="${imagem.src}" alt="${escapar(imagem.descricao)}" width="${largura}" height="${altura}" style="max-width:100%;height:auto"></p>`;
}

/**
 * A prova para os estudantes em HTML, com as imagens anexadas: para colar num editor de texto. Mesmo conteúdo de formatarProvaComoTexto (sem gabarito, sem códigos).
 */
export function formatarProvaComoHtml(prova: ProvaAvaliacao, imagens: ImagensDaProva = {}): string {
  const partes = [`<h1>${escapar(prova.titulo)}</h1>`];
  const linhas = cabecalho(prova);
  if (linhas.length > 0) partes.push(`<p>${linhas.map(escapar).join("<br>")}</p>`);
  partes.push("<p>Nome: ____________________________________&nbsp;&nbsp;Data: ___/___/______</p>");
  if (prova.instrucoes.length > 0) {
    partes.push("<h2>Instruções</h2>", `<ul>${prova.instrucoes.map((item) => `<li>${escapar(item)}</li>`).join("")}</ul>`);
  }

  for (const questao of prova.questoes) {
    const imagem = imagens[questao.numero];
    const corpo = [`<p><strong>${questao.numero}.</strong> ${comQuebras(questao.enunciado)}</p>`];
    if (imagem) corpo.push(imagemComoHtml(imagem));
    if (questao.tipo === "multipla_escolha") {
      corpo.push(...questao.alternativas.map((alternativa) => `<p class="alternativa">(${alternativa.letra}) ${escapar(alternativa.texto)}</p>`));
    } else {
      corpo.push(...Array.from({ length: 3 }, () => '<p class="linha">&nbsp;</p>'));
    }
    partes.push(`<div class="questao">${corpo.join("")}</div>`);
  }
  return partes.join("\n");
}

/** Gabarito com a habilidade de cada questão e os critérios de correção. */
export function formatarGabaritoComoTexto(prova: ProvaAvaliacao): string {
  const linhas = [`GABARITO: ${prova.titulo}`, ...cabecalho(prova), ""];
  for (const questao of prova.questoes) {
    const resposta = questao.tipo === "multipla_escolha" ? `(${questao.resposta})` : questao.resposta;
    // Questão escrita à mão pode ficar sem código BNCC.
    linhas.push(`${questao.numero}. ${questao.habilidade ? `[${questao.habilidade}] ` : ""}${resposta}`);
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
