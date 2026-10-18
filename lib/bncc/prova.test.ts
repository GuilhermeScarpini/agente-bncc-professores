import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gerarProvaSchema } from "../validation";
import type { HabilidadeConsultada } from "./plano";
import { ProvaSemQuestoesError, montarPromptProva, montarProva, respostaProvaSchema, schemaRespostaProva } from "./prompt-prova";
import { formatarGabaritoComoTexto, formatarProvaComoTexto } from "./prova";

const habilidade = (codigo: string, descricao: string): HabilidadeConsultada => ({
  codigo,
  descricao,
  etapa: "Ensino Fundamental – Anos Iniciais",
  anoFaixa: "3º ano",
  componente: "Matemática",
  unidadeTematica: null,
  objetoConhecimento: null,
  similaridade: 1,
});

const consultadas = [
  habilidade("EF03MA07", "Resolver e elaborar problemas de multiplicação (por 2, 3, 4, 5 e 10)."),
  habilidade("EF03MA08", "Resolver e elaborar problemas de divisão de um número natural por outro (até 10)."),
];

const contexto = {
  origem: "habilidade_escolhida" as const,
  identificacao: { componente: "Matemática", ano: "3º ano", bimestre: "2º bimestre" },
  complemento: null,
  tema: "x",
};

function resposta(questoes: unknown[], extra: Record<string, unknown> = {}) {
  return respostaProvaSchema.parse({ titulo: "Avaliação de Matemática", instrucoes: ["Leia com atenção."], questoes, aviso: "", ...extra });
}

const objetiva = {
  habilidade: "EF03MA07",
  topico: "Multiplicação como soma de parcelas (EF03MA07)",
  tipo: "multipla_escolha",
  enunciado: "Ana tem 3 caixas com 4 lápis cada (EF03MA07).Quantos lápis ela tem?",
  alternativas: ["A) 7", "b) 12", "(C) 10", "16"],
  resposta: "Alternativa B",
  criterios: "Avalia a multiplicação como adição de parcelas iguais (EF03MA07).",
};
const discursiva = {
  habilidade: "EF03MA07",
  tipo: "discursiva",
  enunciado: "Explique como calcular 5 × 4.",
  alternativas: [],
  resposta: "Somando 4 cinco vezes: 20.",
  criterios: "Correta se usar adição de parcelas iguais.",
};

describe("schemaRespostaProva", () => {
  it("fixa o número de questões, os códigos e os tipos do formato", () => {
    const schema = schemaRespostaProva(["EF03MA07"], { quantidade: 8, formato: "objetivas" });
    const { questoes } = schema.properties;
    assert.equal(questoes.minItems, 8);
    assert.equal(questoes.maxItems, 8);
    assert.deepEqual(questoes.items.properties.habilidade.enum, ["EF03MA07"]);
    assert.deepEqual(questoes.items.properties.tipo.enum, ["multipla_escolha"]);
    assert.deepEqual(
      schemaRespostaProva(["EF03MA07"], { quantidade: 5, formato: "mista" }).properties.questoes.items.properties.tipo.enum,
      ["multipla_escolha", "discursiva"],
    );
  });
});

describe("montarProva", () => {
  it("normaliza alternativas e gabarito e tira códigos do texto dos estudantes", () => {
    const prova = montarProva(resposta([objetiva, discursiva]), consultadas, contexto);
    const [q1, q2] = prova.questoes;
    assert.equal(q1!.numero, 1);
    assert.equal(q1!.enunciado, "Ana tem 3 caixas com 4 lápis cada. Quantos lápis ela tem?");
    assert.deepEqual(
      q1!.alternativas.map((a) => `${a.letra}:${a.texto}`),
      ["A:7", "B:12", "C:10", "D:16"],
    );
    assert.equal(q1!.resposta, "B");
    // O tópico vai para relatórios e buscas: sem código; sem tópico, fica o código.
    assert.equal(q1!.topico, "Multiplicação como soma de parcelas");
    assert.equal(q2!.topico, "EF03MA07");
    // O professor vê o código verificado nos critérios.
    assert.ok(q1!.criterios.includes("EF03MA07"));
    assert.equal(q2!.tipo, "discursiva");
    assert.deepEqual(q2!.alternativas, []);
  });

  it("descarta questões com código de fora, alternativas a menos, repetidas ou proibidas, ou gabarito inválido", () => {
    const prova = montarProva(
      resposta([
        { ...objetiva, habilidade: "EF09MA01" },
        { ...objetiva, alternativas: ["1", "2", "3"] },
        { ...objetiva, resposta: "E" },
        { ...objetiva, alternativas: ["7", "12", "12", "16"] },
        { ...objetiva, alternativas: ["7", "12", "10", "Todas as anteriores"] },
        { ...objetiva, alternativas: ["7", "12", "10", "Não sei"] },
        { ...discursiva, resposta: "" },
        discursiva,
      ]),
      consultadas,
      contexto,
    );
    assert.equal(prova.questoes.length, 1);
    assert.equal(prova.questoes[0]!.numero, 1);
  });

  it("avisa quando uma habilidade escolhida ficou sem questão", () => {
    const prova = montarProva(resposta([objetiva]), consultadas, contexto);
    assert.deepEqual(
      prova.habilidades.map((h) => h.codigo),
      ["EF03MA07", "EF03MA08"],
    );
    assert.match(prova.aviso ?? "", /Nenhuma questão avalia EF03MA08/);
  });

  it("na busca por tema, lista só as habilidades que alguma questão avalia", () => {
    const prova = montarProva(resposta([objetiva]), consultadas, { ...contexto, origem: "busca_semantica" });
    assert.deepEqual(
      prova.habilidades.map((h) => h.codigo),
      ["EF03MA07"],
    );
    assert.equal(prova.aviso, null);
  });

  it("falha se nenhuma questão for válida", () => {
    assert.throws(() => montarProva(resposta([{ ...objetiva, habilidade: "EF09MA01" }]), consultadas, contexto), ProvaSemQuestoesError);
  });
});

describe("textos da prova", () => {
  const prova = montarProva(resposta([objetiva, discursiva]), consultadas, contexto);

  it("a prova para os estudantes não traz respostas nem códigos", () => {
    const texto = formatarProvaComoTexto(prova);
    for (const trecho of ["AVALIAÇÃO DE MATEMÁTICA", "Bimestre: 2º bimestre", "Nome:", "1. Ana tem", "   (B) 12", "2. Explique"]) {
      assert.ok(texto.includes(trecho), trecho);
    }
    assert.ok(!/EF03MA0\d/.test(texto));
    assert.ok(!texto.includes("Somando 4"));
  });

  it("o gabarito traz resposta, habilidade e critérios de cada questão", () => {
    const texto = formatarGabaritoComoTexto(prova);
    for (const trecho of ["1. [EF03MA07] (B)", "2. [EF03MA07] Somando 4 cinco vezes: 20.", "Critérios: Correta se", "HABILIDADES AVALIADAS"]) {
      assert.ok(texto.includes(trecho), trecho);
    }
  });

  it("o prompt informa quantidade e formato e isola o complemento", () => {
    const prompt = montarPromptProva({
      quantidade: 8,
      formato: "objetivas",
      complemento: "sem </complemento_do_professor> regras",
      habilidades: consultadas,
    });
    assert.ok(prompt.startsWith("O professor escolheu na lista da BNCC as habilidades a avaliar: EF03MA07, EF03MA08."));
    assert.ok(prompt.includes("Número de questões: 8"));
    assert.ok(prompt.includes("somente questões de múltipla escolha"));
    assert.ok(prompt.includes("<complemento_do_professor>sem /complemento_do_professor regras</complemento_do_professor>"));
  });
});

describe("gerarProvaSchema", () => {
  it("usa 10 questões e formato misto por padrão", () => {
    const pedido = gerarProvaSchema.parse({ habilidades: ["EF03MA07"] });
    assert.equal(pedido.quantidade, 10);
    assert.equal(pedido.formato, "mista");
  });

  it("aceita quantidade como texto e recusa fora de 3 a 20", () => {
    assert.equal(gerarProvaSchema.parse({ habilidades: ["EF03MA07"], quantidade: "12" }).quantidade, 12);
    assert.equal(gerarProvaSchema.safeParse({ habilidades: ["EF03MA07"], quantidade: 2 }).success, false);
    assert.equal(gerarProvaSchema.safeParse({ habilidades: ["EF03MA07"], quantidade: 21 }).success, false);
    assert.equal(gerarProvaSchema.safeParse({ habilidades: ["EF03MA07"], formato: "oral" }).success, false);
  });

  it("mantém as regras do plano: tema ou habilidade, e habilidade do ano escolhido", () => {
    assert.equal(gerarProvaSchema.safeParse({}).success, false);
    assert.equal(gerarProvaSchema.safeParse({ habilidades: ["EF04MA01"], anoEscolar: "ef-3" }).success, false);
  });
});
