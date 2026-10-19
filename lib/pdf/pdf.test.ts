import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { inflateSync } from "node:zlib";
import { anoMaisAlto } from "../bncc/escopo";
import type { PlanoAula } from "../bncc/plano";
import { encaixarImagem } from "./escritor";
import { gerarPdfDoPlano } from "./plano-pdf";
import { gerarPdfDaProva, type ProvaParaPdf } from "./prova-pdf";
import { nomeDeArquivo, quebrarTexto } from "./quebra";

/** O texto desenhado no PDF (o pdf-lib escreve cada linha como <hex> Tj, em streams comprimidos). */
function textoDoPdf(bytes: Uint8Array): string {
  const bruto = Buffer.from(bytes).toString("latin1");
  const partes: string[] = [];
  for (const stream of bruto.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)) {
    let conteudo: string;
    try {
      conteudo = inflateSync(Buffer.from(stream[1]!, "latin1")).toString("latin1");
    } catch {
      conteudo = stream[1]!;
    }
    for (const texto of conteudo.matchAll(/<([0-9A-Fa-f]*)>\s*Tj/g)) partes.push(Buffer.from(texto[1]!, "hex").toString("latin1"));
  }
  return partes.join("\n");
}

const habilidade = {
  codigo: "EF03MA07",
  descricao: "Resolver e elaborar problemas de multiplicação (por 2, 3, 4, 5 e 10).",
  etapa: "Ensino Fundamental – Anos Iniciais",
  anoFaixa: "3º ano",
  componente: "Matemática",
  unidadeTematica: null,
  objetoConhecimento: null,
  similaridade: 1,
};

const prova: ProvaParaPdf = {
  titulo: "Avaliação de Multiplicação",
  identificacao: { componente: "Matemática", ano: "3º ano", bimestre: null },
  instrucoes: ["Leia com atenção."],
  questoes: [
    {
      numero: 1,
      habilidade: "EF03MA07",
      topico: "Multiplicação como soma de parcelas",
      tipo: "multipla_escolha",
      enunciado: "Ana tem 3 caixas com 4 lápis cada. Quantos lápis ela tem?",
      alternativas: [
        { letra: "A", texto: "7" },
        { letra: "B", texto: "12" },
        { letra: "C", texto: "10" },
        { letra: "D", texto: "16" },
      ],
      resposta: "B",
      criterios: "Avalia a multiplicação como adição de parcelas iguais.",
    },
    {
      numero: 2,
      habilidade: "EF03MA07",
      topico: "Explicar a estratégia",
      tipo: "discursiva",
      enunciado: "Explique como calcular 5 × 4.",
      alternativas: [],
      resposta: "Somando 4 cinco vezes: 20.",
      criterios: "Correta se usar adição de parcelas iguais.",
    },
  ],
  habilidades: [habilidade],
  aviso: null,
};

// PNG de 1×1 pixel.
const imagem = {
  src: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  largura: 1,
  altura: 1,
  descricao: "",
};

describe("PDF da prova", () => {
  it("a versão dos alunos traz as questões, sem respostas nem códigos BNCC", async () => {
    const bytes = await gerarPdfDaProva(prova, { versao: "alunos" });
    assert.equal(Buffer.from(bytes.slice(0, 5)).toString(), "%PDF-");
    const texto = textoDoPdf(bytes);
    assert.match(texto, /Avaliação de Multiplicação/);
    assert.match(texto, /Matemática · 3º ano/);
    assert.match(texto, /Ana tem 3 caixas/);
    assert.match(texto, /Nome:/);
    assert.doesNotMatch(texto, /EF03MA07/);
    assert.doesNotMatch(texto, /correta|Resposta|Critérios|Somando 4 cinco vezes/);
  });

  it("a versão do professor traz o código BNCC, a resposta e os critérios de cada questão", async () => {
    const texto = textoDoPdf(await gerarPdfDaProva(prova, { versao: "professor" }));
    assert.match(texto, /VERSÃO DO PROFESSOR/);
    assert.match(texto, /EF03MA07 · Multiplicação como soma de parcelas · Múltipla escolha/);
    assert.match(texto, /12 \(correta\)/);
    assert.match(texto, /alternativa B/);
    assert.match(texto, /Somando 4 cinco vezes: 20\./);
    assert.match(texto, /Avalia a multiplicação/);
    assert.match(texto, /HABILIDADES DA BNCC AVALIADAS/);
    assert.match(texto, /questões 1, 2/);
    assert.doesNotMatch(texto, /Nome:/);
  });

  it("põe a imagem anexada e troca símbolos que a fonte não tem", async () => {
    const comImagem = await gerarPdfDaProva(
      { ...prova, questoes: [{ ...prova.questoes[0]!, enunciado: "Qual número é ≥ 10?" }] },
      { versao: "alunos", imagens: { 1: imagem } },
    );
    const semImagem = await gerarPdfDaProva(prova, { versao: "alunos" });
    assert.match(Buffer.from(comImagem).toString("latin1"), /\/Subtype \/Image/);
    assert.doesNotMatch(Buffer.from(semImagem).toString("latin1"), /\/Subtype \/Image/);
    assert.match(textoDoPdf(comImagem), /Qual número é >= 10\?/);
  });

  it("muitas questões passam para outras páginas", async () => {
    const longa = {
      ...prova,
      questoes: Array.from({ length: 20 }, (_, indice) => ({ ...prova.questoes[0]!, numero: indice + 1 })),
    };
    const texto = textoDoPdf(await gerarPdfDaProva(longa, { versao: "alunos" }));
    assert.match(texto, /Página 1 de [2-9]/);
    assert.match(texto, /20\. /);
  });
});

describe("PDF do plano de aula", () => {
  const plano: PlanoAula = {
    origem: "habilidade_escolhida",
    identificacao: { componente: "Matemática", ano: "3º ano", bimestre: "2º bimestre" },
    tema: habilidade.descricao,
    complemento: "Turma de 28 alunos.",
    titulo: "Multiplicando com caixas de lápis",
    duracao: "50 minutos",
    habilidades: [{ ...habilidade, justificativa: "Os alunos montam grupos iguais." }],
    objetivos: ["Reconhecer a multiplicação como soma de parcelas iguais."],
    metodologia: [{ titulo: "Acolhida", duracao: "10 min", descricao: "Conversa sobre caixas de lápis." }],
    avaliacao: [{ instrumento: "Observação", descricao: "Registro das estratégias." }],
    aviso: null,
    resumoParaFeed: "",
    consultadas: [],
  };

  it("traz o cabeçalho e todas as seções do plano", async () => {
    const texto = textoDoPdf(await gerarPdfDoPlano(plano));
    for (const trecho of [
      "PLANO DE AULA",
      "Multiplicando com caixas de lápis",
      "Bimestre: 2º bimestre",
      "EF03MA07 · Matemática, 3º ano",
      "Como a aula desenvolve:",
      "OBJETIVOS DE APRENDIZAGEM",
      "Acolhida (10 min)",
      "Observação:",
      "Orientações do professor:",
    ]) {
      assert.ok(texto.includes(trecho), `faltou "${trecho}"`);
    }
  });
});

describe("auxiliares dos PDFs", () => {
  it("quebra o texto pela largura e corta palavras longas demais", () => {
    const medir = (valor: string) => valor.length;
    assert.deepEqual(quebrarTexto("um dois tres", medir, 7), ["um dois", "tres"]);
    assert.deepEqual(quebrarTexto("abcdefghij", medir, 4), ["abcd", "efgh", "ij"]);
    assert.deepEqual(quebrarTexto("a\n\nb", medir, 10), ["a", "", "b"]);
  });

  it("monta o nome do arquivo sem acentos nem símbolos", () => {
    assert.equal(nomeDeArquivo("prova-alunos", "Avaliação de Frações: 3º ano!"), "prova-alunos-avaliacao-de-fracoes-3o-ano.pdf");
    assert.equal(nomeDeArquivo("plano-de-aula", "???"), "plano-de-aula.pdf");
  });

  it("encaixa a imagem na caixa sem aumentar", () => {
    assert.deepEqual(encaixarImagem(1200, 600, 300, 210), { largura: 300, altura: 150 });
    assert.deepEqual(encaixarImagem(100, 50, 300, 210), { largura: 100, altura: 50 });
  });

  it("sugere o ano mais avançado entre as habilidades marcadas", () => {
    assert.equal(
      anoMaisAlto([
        { anoEscolar: "ef-2", anoLabel: "2º ano" },
        { anoEscolar: "ef-3", anoLabel: "3º ano" },
      ]),
      "3º ano",
    );
    assert.equal(anoMaisAlto([]), null);
  });
});
