import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gerarPlanoSchema } from "./validation";

function erros(body: unknown) {
  const result = gerarPlanoSchema.safeParse(body);
  return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
}

describe("gerarPlanoSchema", () => {
  it("aceita habilidades escolhidas e complemento, sem tema", () => {
    const result = gerarPlanoSchema.parse({
      habilidades: ["ef03ma07", "EF03MA08"],
      complemento: "  Turma de 28 alunos.  ",
      componente: "Matemática",
      anoEscolar: "ef-3",
      bimestre: 2,
    });
    assert.deepEqual(result, {
      habilidades: ["EF03MA07", "EF03MA08"],
      complemento: "Turma de 28 alunos.",
      componente: "Matemática",
      anoEscolar: "ef-3",
      bimestre: "2",
    });
  });

  it("continua aceitando o tema livre, e complemento vazio vira ausente", () => {
    const result = gerarPlanoSchema.parse({ tema: "frações com receitas", complemento: " " });
    assert.equal(result.tema, "frações com receitas");
    assert.equal(result.complemento, undefined);
  });

  it("exige tema ou ao menos uma habilidade", () => {
    const esperado = ["tema: Escolha uma habilidade da lista ou conte o tema da aula."];
    assert.deepEqual(erros({ tema: "  " }), esperado);
    assert.deepEqual(erros({ habilidades: [] }), esperado);
  });

  it("confere cada habilidade contra a disciplina e o ano", () => {
    assert.match(erros({ habilidades: ["EF03MA07"], componente: "Língua Portuguesa" })[0]!, /é de Matemática/);
    assert.match(erros({ habilidades: ["EF03MA07", "EF04MA01"], anoEscolar: "ef-3" })[0]!, /EF04MA01 não é do ano escolhido/);
    assert.deepEqual(erros({ habilidades: ["EF35LP01", "EF04LP01"], anoEscolar: "ef-4" }), []);
    assert.match(erros({ habilidades: ["XX01"] })[0]!, /não é um código/);
  });

  it("limita a 5 habilidades, sem repetição, e o complemento a 500 caracteres", () => {
    const seis = ["EF03MA01", "EF03MA02", "EF03MA03", "EF03MA04", "EF03MA05", "EF03MA06"];
    assert.match(erros({ habilidades: seis })[0]!, /no máximo 5/);
    assert.match(erros({ habilidades: ["EF03MA01", "ef03ma01"] })[0]!, /repetidas/);
    assert.match(erros({ habilidades: ["EF03MA01"], complemento: "a".repeat(501) })[0]!, /complemento: .*500/);
  });

  it("recusa bimestre fora de 1 a 4", () => {
    assert.match(erros({ habilidades: ["EF03MA07"], bimestre: 5 })[0]!, /bimestre/);
  });
});
