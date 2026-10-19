import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gerarPlanoSchema } from "../validation";
import { escopoDoPedido, type HabilidadeMarcada } from "./escopo";

const marcada = (codigo: string, anoEscolar: string, bimestre: HabilidadeMarcada["bimestre"]): HabilidadeMarcada => ({
  codigo,
  descricao: "",
  anoEscolar,
  anoLabel: anoEscolar,
  bimestre,
});

describe("escopoDoPedido", () => {
  it("sem habilidades marcadas, não manda ano nem bimestre", () => {
    assert.deepEqual(escopoDoPedido([]), {});
  });

  it("todas do mesmo ano e bimestre: manda os dois", () => {
    assert.deepEqual(escopoDoPedido([marcada("EF03MA07", "ef-3", "2"), marcada("EF03MA08", "ef-3", "2")]), {
      anoEscolar: "ef-3",
      bimestre: "2",
    });
  });

  it("mesmo ano, bimestres diferentes: manda só o ano", () => {
    assert.deepEqual(escopoDoPedido([marcada("EF03MA07", "ef-3", "2"), marcada("EF03MA01", "ef-3", "1")]), {
      anoEscolar: "ef-3",
    });
  });

  it("anos diferentes: não manda ano nem bimestre", () => {
    assert.deepEqual(escopoDoPedido([marcada("EF03MA07", "ef-3", "2"), marcada("EF02MA05", "ef-2", "2")]), {});
  });

  it("o pedido com habilidades de anos diferentes passa na validação da API", () => {
    const marcadas = [marcada("EF03MA07", "ef-3", "2"), marcada("EF02MA05", "ef-2", "3")];
    const pedido = { componente: "Matemática", habilidades: marcadas.map((item) => item.codigo), ...escopoDoPedido(marcadas) };
    assert.equal(gerarPlanoSchema.safeParse(pedido).success, true);
  });
});
