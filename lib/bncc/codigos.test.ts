import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ANOS_ESCOLARES, COMPONENTES, findAnoEscolar, parseCodigoBncc } from "./codigos";

describe("parseCodigoBncc", () => {
  it("interpreta habilidades de um único ano do Ensino Fundamental", () => {
    assert.deepEqual(parseCodigoBncc("EF07CI04"), {
      codigo: "EF07CI04",
      etapaSigla: "EF",
      componente: "Ciências",
      etapa: "Ensino Fundamental – Anos Finais",
      anoInicio: 7,
      anoFim: 7,
      anoFaixa: "7º ano",
    });
  });

  it("interpreta faixas de anos", () => {
    assert.equal(parseCodigoBncc("EF67LP27")?.anoFaixa, "6º e 7º anos");
    assert.equal(parseCodigoBncc("EF15LP01")?.anoFaixa, "1º ao 5º ano");
    assert.equal(parseCodigoBncc("EF15LP01")?.etapa, "Ensino Fundamental – Anos Iniciais");
    assert.deepEqual([parseCodigoBncc("EF69AR01")?.anoInicio, parseCodigoBncc("EF69AR01")?.anoFim], [6, 9]);
  });

  it("interpreta Educação Infantil e Ensino Médio", () => {
    const ei = parseCodigoBncc("EI03EO01");
    assert.equal(ei?.componente, "O eu, o outro e o nós");
    assert.equal(ei?.anoInicio, 0);
    assert.equal(parseCodigoBncc("EI01TS01")?.anoInicio, -2);
    assert.equal(parseCodigoBncc("EI02EF01")?.componente, "Escuta, fala, pensamento e imaginação");

    const em = parseCodigoBncc("EM13LGG101");
    assert.equal(em?.componente, "Linguagens e suas Tecnologias");
    assert.deepEqual([em?.anoInicio, em?.anoFim, em?.anoFaixa], [10, 12, "1ª a 3ª série"]);
    assert.equal(parseCodigoBncc("EM13LP01")?.componente, "Língua Portuguesa");
  });

  it("normaliza espaços e minúsculas", () => {
    assert.equal(parseCodigoBncc("  ef06ma07 ")?.codigo, "EF06MA07");
  });

  it("rejeita códigos inexistentes", () => {
    for (const codigo of ["", "EF07XX04", "EF56MA01", "EF10MA01", "EF00MA01", "EF71MA01", "EI04EO01", "EM12LGG101", "EM13LP101", "EM13MAT10", "EF07CI4", "EF07CI004"]) {
      assert.equal(parseCodigoBncc(codigo), null, codigo);
    }
  });
});

describe("filtros do planejador", () => {
  it("ano escolar casa com as faixas da BNCC", () => {
    const setimo = findAnoEscolar("ef-7")!;
    const ef69 = parseCodigoBncc("EF69LP01")!;
    assert.ok(ef69.anoInicio <= setimo.fim && ef69.anoFim >= setimo.inicio);
    const em = findAnoEscolar("em")!;
    const em13 = parseCodigoBncc("EM13MAT101")!;
    assert.ok(em13.anoInicio <= em.fim && em13.anoFim >= em.inicio);
    for (const serie of ["em-1", "em-2", "em-3"]) {
      const opcao = findAnoEscolar(serie)!;
      assert.ok(em13.anoInicio <= opcao.fim && em13.anoFim >= opcao.inicio, serie);
    }
    assert.equal(findAnoEscolar("em-3")?.label, "3ª série do Ensino Médio");
  });

  it("não repete opções", () => {
    assert.equal(new Set(COMPONENTES).size, COMPONENTES.length);
    assert.equal(new Set(ANOS_ESCOLARES.map((opcao) => opcao.value)).size, ANOS_ESCOLARES.length);
  });
});
