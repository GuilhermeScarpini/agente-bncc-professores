// Leitura do arquivo de habilidades da BNCC (JSON ou CSV) usado pelo seed.
// Etapa, ano/faixa e componente são sempre derivados do código oficial: assim os
// filtros do planejador batem com os dados, venha o arquivo de onde vier.
import { formatEmbeddingDocument } from "../ai/gemini";
import { parseCodigoBncc } from "./codigos";

export interface HabilidadeRegistro {
  id: string;
  etapa: string;
  anoFaixa: string;
  anoInicio: number;
  anoFim: number;
  componente: string;
  unidadeTematica: string | null;
  objetoConhecimento: string | null;
  descricao: string;
}

export interface DatasetResult {
  habilidades: HabilidadeRegistro[];
  avisos: string[];
}

type Campo = "codigo" | "descricao" | "unidadeTematica" | "objetoConhecimento";

/** Nomes de coluna aceitos (já normalizados: minúsculas, sem acento, "_" no lugar de espaços). */
const ALIASES: Record<string, Campo> = {
  id: "codigo",
  codigo: "codigo",
  code: "codigo",
  codigo_habilidade: "codigo",
  descricao: "descricao",
  descricao_habilidade: "descricao",
  habilidade: "descricao",
  texto: "descricao",
  unidade_tematica: "unidadeTematica",
  unidadetematica: "unidadeTematica",
  unidades_tematicas: "unidadeTematica",
  objeto_conhecimento: "objetoConhecimento",
  objetoconhecimento: "objetoConhecimento",
  objeto_de_conhecimento: "objetoConhecimento",
  objetos_de_conhecimento: "objetoConhecimento",
};

function normalizeKey(key: string): string {
  return key
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function cleanText(value: unknown): string {
  return typeof value === "string" || typeof value === "number" ? String(value).replace(/\s+/g, " ").trim() : "";
}

/** CSV com aspas (RFC 4180). O separador (; , ou tab) é detectado pelo cabeçalho. */
export function parseCsv(content: string): Record<string, string>[] {
  const text = content.replace(/^﻿/, "");
  const headerLine = text.slice(0, text.search(/\r?\n|$/));
  const delimiter = [";", "\t", ","].reduce((best, candidate) =>
    headerLine.split(candidate).length > headerLine.split(best).length ? candidate : best,
  );

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inQuotes) {
      if (char === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      inQuotes = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  const [header = [], ...body] = rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
  return body.map((cells) => Object.fromEntries(header.map((name, column) => [name, cells[column] ?? ""])));
}

/** Aceita um array de objetos ou { habilidades: [...] }. */
function parseJson(content: string): Record<string, unknown>[] {
  const data: unknown = JSON.parse(content);
  const list = Array.isArray(data) ? data : (data as { habilidades?: unknown })?.habilidades;
  if (!Array.isArray(list)) throw new Error('JSON inválido: use um array ou um objeto com "habilidades": [...].');
  return list as Record<string, unknown>[];
}

export function parseDataset(content: string, format: "json" | "csv"): DatasetResult {
  const rows = format === "json" ? parseJson(content) : parseCsv(content);
  const habilidades = new Map<string, HabilidadeRegistro>();
  const avisos: string[] = [];

  rows.forEach((raw, index) => {
    const linha = format === "csv" ? `linha ${index + 2}` : `item ${index + 1}`;
    const campos: Partial<Record<Campo, string>> = {};
    for (const [key, value] of Object.entries(raw ?? {})) {
      const campo = ALIASES[normalizeKey(key)];
      if (campo && !campos[campo]) campos[campo] = cleanText(value);
    }

    const info = parseCodigoBncc(campos.codigo ?? "");
    if (!info) {
      avisos.push(`${linha}: código BNCC inválido ("${campos.codigo ?? ""}") — ignorado.`);
      return;
    }
    if (!campos.descricao) {
      avisos.push(`${linha}: ${info.codigo} sem descrição — ignorado.`);
      return;
    }
    if (habilidades.has(info.codigo)) {
      avisos.push(`${linha}: ${info.codigo} repetido — mantida a primeira ocorrência.`);
      return;
    }

    habilidades.set(info.codigo, {
      id: info.codigo,
      etapa: info.etapa,
      anoFaixa: info.anoFaixa,
      anoInicio: info.anoInicio,
      anoFim: info.anoFim,
      componente: info.componente,
      unidadeTematica: campos.unidadeTematica || null,
      objetoConhecimento: campos.objetoConhecimento || null,
      descricao: campos.descricao,
    });
  });

  return { habilidades: [...habilidades.values()], avisos };
}

/** "Ciências 7º ano Matéria e energia: Avaliar o papel do equilíbrio termodinâmico..." */
export function textoSemantico(habilidade: HabilidadeRegistro): string {
  const contexto = [habilidade.componente, habilidade.anoFaixa, habilidade.unidadeTematica].filter(Boolean).join(" ");
  return `${contexto}: ${habilidade.descricao}`;
}

/** Texto enviado ao modelo de embedding, já no formato de documento que ele espera. */
export function textoParaEmbedding(habilidade: HabilidadeRegistro): string {
  return formatEmbeddingDocument(habilidade.objetoConhecimento, textoSemantico(habilidade));
}
