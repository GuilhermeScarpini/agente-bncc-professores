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
  it("aceita o arquivo distribuído com o projeto: 8 disciplinas, do 1º ao 5º ano", () => {
    const { disciplinas } = parseCalendario(arquivo);
    assert.deepEqual(
      disciplinas.map((d) => d.nome),
      ["Matemática", "Língua Portuguesa", "Arte", "Educação Física", "Ciências", "Geografia", "História", "Ensino Religioso"],
    );
    for (const disciplina of disciplinas) {
      assert.deepEqual(
        disciplina.anos.filter((a) => a.disponivel).map((a) => a.label),
        ["1º ano", "2º ano", "3º ano", "4º ano", "5º ano"],
        disciplina.nome,
      );
    }
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

  it("monta os quatro bimestres e marca anos vazios como indisponíveis", () => {
    const { disciplinas } = parseCalendario(calendario({ "3": { "2": ["ef03ma07"] } }));
    const [primeiro, , terceiro] = disciplinas[0]!.anos;
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
