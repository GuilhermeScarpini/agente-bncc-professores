import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { parseCsv, parseDataset, textoParaEmbedding, textoSemantico } from "./dataset";

describe("parseCsv", () => {
  it("lida com aspas, separador ; e quebras de linha dentro do campo", () => {
    const rows = parseCsv('﻿id;descricao\r\nEF07CI04;"Avaliar o papel; com ""aspas""\ne quebra"\r\n');
    assert.deepEqual(rows, [{ id: "EF07CI04", descricao: 'Avaliar o papel; com "aspas"\ne quebra' }]);
  });

  it("detecta vírgula como separador", () => {
    assert.deepEqual(parseCsv('codigo,descricao\nEF06MA07,"Compreender, comparar e ordenar frações"'), [
      { codigo: "EF06MA07", descricao: "Compreender, comparar e ordenar frações" },
    ]);
  });
});

describe("parseDataset", () => {
  it("aceita as colunas do spec e deriva etapa/ano/componente do código", () => {
    const csv = [
      "id;etapa;ano_faixa;componente;unidade_tematica;objeto_conhecimento;descricao",
      "EF07CI04;x;y;z;Matéria e energia;Equilíbrio termodinâmico e vida na Terra;Avaliar o papel do equilíbrio.",
    ].join("\n");
    const { habilidades, avisos } = parseDataset(csv, "csv");
    assert.deepEqual(avisos, []);
    assert.deepEqual(habilidades[0], {
      id: "EF07CI04",
      etapa: "Ensino Fundamental – Anos Finais",
      anoFaixa: "7º ano",
      anoInicio: 7,
      anoFim: 7,
      componente: "Ciências",
      unidadeTematica: "Matéria e energia",
      objetoConhecimento: "Equilíbrio termodinâmico e vida na Terra",
      descricao: "Avaliar o papel do equilíbrio.",
    });
    assert.equal(textoSemantico(habilidades[0]!), "Ciências 7º ano Matéria e energia: Avaliar o papel do equilíbrio.");
    assert.equal(
      textoParaEmbedding(habilidades[0]!),
      "title: Equilíbrio termodinâmico e vida na Terra | text: Ciências 7º ano Matéria e energia: Avaliar o papel do equilíbrio.",
    );
  });

  it("aceita JSON com cabeçalho acentuado e avisa sobre linhas ruins", () => {
    const json = JSON.stringify({
      habilidades: [
        { "Código": "ef06ma07", "Descrição": "Compreender frações." },
        { codigo: "XX01", descricao: "inválido" },
        { codigo: "EF06MA08", descricao: "" },
        { codigo: "EF06MA07", descricao: "duplicado" },
      ],
    });
    const { habilidades, avisos } = parseDataset(json, "json");
    assert.deepEqual(
      habilidades.map((habilidade) => habilidade.id),
      ["EF06MA07"],
    );
    assert.equal(habilidades[0]!.unidadeTematica, null);
    assert.equal(textoSemantico(habilidades[0]!), "Matemática 6º ano: Compreender frações.");
    assert.equal(avisos.length, 3);
  });

  it("o arquivo embutido tem a BNCC completa e válida", () => {
    const content = readFileSync(new URL("../../prisma/data/bncc-habilidades.json", import.meta.url), "utf8");
    const { habilidades, avisos } = parseDataset(content, "json");
    assert.deepEqual(avisos, []);
    assert.equal(habilidades.length, 1580);
    const porEtapa = Object.groupBy(habilidades, (habilidade) => habilidade.id.slice(0, 2));
    assert.deepEqual(
      [porEtapa.EI?.length, porEtapa.EF?.length, porEtapa.EM?.length],
      [93, 1304, 183],
    );
    assert.equal(
      habilidades.find((habilidade) => habilidade.id === "EF07CI04")?.descricao,
      "Avaliar o papel do equilíbrio termodinâmico para a manutenção da vida na Terra, para o funcionamento de máquinas térmicas e em outras situações cotidianas.",
    );
  });
});
