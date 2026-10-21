import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseCalendario } from "./bimestres";
import { parseCodigoBncc } from "./codigos";

const lerJson = (caminho: string) => JSON.parse(readFileSync(new URL(caminho, import.meta.url), "utf8"));
const arquivo = lerJson("../../prisma/data/bncc-bimestres.json");
const habilidadesOficiais = lerJson("../../prisma/data/bncc-habilidades.json").habilidades;

function calendario(anos: Record<string, Record<string, string[]>>, nome = "Matemática") {
  return { anos: [1, 2, 3], disciplinas: [{ nome, anos }] };
}

describe("parseCalendario", () => {
  it("aceita o arquivo distribuído com o projeto: do 1º ao 9º ano e as 3 séries do Ensino Médio", () => {
    const { disciplinas } = parseCalendario(arquivo);
    const fundamental = Array.from({ length: 9 }, (_, index) => `${index + 1}º ano`);
    const medio = ["1ª série do Ensino Médio", "2ª série do Ensino Médio", "3ª série do Ensino Médio"];
    const esperado: Record<string, string[]> = {
      Matemática: fundamental,
      "Língua Portuguesa": [...fundamental, ...medio],
      Arte: fundamental,
      "Educação Física": fundamental,
      "Língua Inglesa": fundamental.slice(5),
      Ciências: fundamental,
      Geografia: fundamental,
      História: fundamental,
      "Ensino Religioso": fundamental,
      "Linguagens e suas Tecnologias": medio,
      "Matemática e suas Tecnologias": medio,
      "Ciências da Natureza e suas Tecnologias": medio,
      "Ciências Humanas e Sociais Aplicadas": medio,
    };
    assert.deepEqual(
      disciplinas.map((d) => d.nome),
      Object.keys(esperado),
    );
    for (const disciplina of disciplinas) {
      assert.deepEqual(
        disciplina.anos.map((a) => [a.label, a.disponivel]),
        esperado[disciplina.nome]!.map((label) => [label, true]),
        disciplina.nome,
      );
    }
  });

  it("toda habilidade oficial do Fundamental e do Ensino Médio aparece em algum bimestre", () => {
    const distribuidas = new Set(
      parseCalendario(arquivo).disciplinas.flatMap((d) => d.anos.flatMap((a) => a.bimestres.flatMap((b) => b.codigos))),
    );
    const faltando = (habilidadesOficiais as { codigo: string }[])
      .map((item) => item.codigo)
      .filter((codigo) => !codigo.startsWith("EI") && !distribuidas.has(codigo));
    assert.deepEqual(faltando, []);
  });

  it("cada ano traz todas as habilidades da BNCC que valem para ele, uma vez cada", () => {
    const oficiais = (habilidadesOficiais as { codigo: string }[]).flatMap((item) => {
      const info = parseCodigoBncc(item.codigo);
      return info ? [info] : [];
    });
    for (const disciplina of parseCalendario(arquivo).disciplinas) {
      for (const ano of disciplina.anos) {
        const distribuidas = ano.bimestres.flatMap((b) => b.codigos);
        const esperadas = oficiais
          .filter((info) => info.componente === disciplina.nome && info.anoInicio <= ano.ano && info.anoFim >= ano.ano)
          .map((info) => info.codigo);
        assert.deepEqual([...distribuidas].sort(), [...esperadas].sort(), `${disciplina.nome}, ${ano.label}`);
      }
    }
  });

  it("monta os quatro bimestres, marca anos vazios como indisponíveis e omite os que não têm chave", () => {
    const { disciplinas } = parseCalendario(calendario({ "1": {}, "3": { "2": ["ef03ma07"] } }));
    assert.deepEqual(
      disciplinas[0]!.anos.map((a) => a.label),
      ["1º ano", "3º ano"],
    );
    const [primeiro, terceiro] = disciplinas[0]!.anos;
    assert.equal(primeiro!.disponivel, false);
    assert.equal(terceiro!.anoEscolar, "ef-3");
    assert.deepEqual(
      terceiro!.bimestres.map((b) => [b.label, b.codigos]),
      [
        ["1º bimestre", []],
        ["2º bimestre", ["EF03MA07"]],
        ["3º bimestre", []],
        ["4º bimestre", []],
      ],
    );
  });

  it("mapeia 10 a 12 para as séries do Ensino Médio", () => {
    const { disciplinas } = parseCalendario({
      anos: [10, 11, 12],
      disciplinas: [{ nome: "Matemática e suas Tecnologias", anos: { "11": { "1": ["EM13MAT101"] } } }],
    });
    const [serie] = disciplinas[0]!.anos;
    assert.equal(serie!.anoEscolar, "em-2");
    assert.equal(serie!.label, "2ª série do Ensino Médio");
  });

  it("aceita habilidades de faixa no ano que elas cobrem", () => {
    assert.doesNotThrow(() => parseCalendario(calendario({ "3": { "1": ["EF35LP01"] } }, "Língua Portuguesa")));
  });

  it("lista todos os problemas de uma vez", () => {
    assert.throws(
      () =>
        parseCalendario(
          calendario({
            "3": { "1": ["EF04MA01", "EF03LP01", "XX123", "EF03MA01"], "2": ["EF03MA01"], "5": [] },
            "7": {},
          }),
        ),
      (error: Error) => {
        for (const trecho of ["vale para 4º ano", "é de Língua Portuguesa", '"XX123"', "mais de uma vez", 'bimestre "5"', 'ano "7"']) {
          assert.ok(error.message.includes(trecho), `faltou: ${trecho}`);
        }
        return true;
      },
    );
  });

  it("recusa disciplina fora do formato", () => {
    assert.throws(() => parseCalendario({ anos: [3], disciplinas: [] }), /fora do formato/);
  });
});
