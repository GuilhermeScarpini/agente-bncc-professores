// Carrega as habilidades da BNCC no banco e gera os embeddings do planejador de aulas.
// Idempotente: só grava o que mudou e só chama a API do Gemini para textos novos ou
// alterados. O progresso é salvo a cada lote, então dá para interromper e rodar de novo.
//
//   npm run db:seed-bncc                              arquivo embutido (BNCC completa)
//   npm run db:seed-bncc -- --arquivo habilidades.csv CSV ou JSON próprio
//   npm run db:seed-bncc -- --forcar                  recalcula todos os embeddings
import "dotenv/config";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { parseArgs } from "node:util";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../generated/prisma/client";
import { EMBEDDING_KEY_PREFIX, GeminiError, gemini, isGeminiConfigured } from "../lib/ai/gemini";
import { parseDataset, textoParaEmbedding, type HabilidadeRegistro } from "../lib/bncc/dataset";
import { vectorToBytes } from "../lib/bncc/vetores";

const prisma = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./bncc.db" }),
});

const ARQUIVO_PADRAO = resolve(import.meta.dirname, "../prisma/data/bncc-habilidades.json");
const LOTE = 100;

function embeddingKey(texto: string): string {
  return EMBEDDING_KEY_PREFIX + createHash("sha256").update(texto).digest("hex").slice(0, 16);
}

/** Grava só as habilidades novas ou com algum campo diferente do que já está no banco. */
async function salvarTextos(habilidades: HabilidadeRegistro[]): Promise<number> {
  const registros = await prisma.bnccHabilidade.findMany({
    select: {
      id: true,
      etapa: true,
      anoFaixa: true,
      anoInicio: true,
      anoFim: true,
      componente: true,
      unidadeTematica: true,
      objetoConhecimento: true,
      descricao: true,
    },
  });
  const atuais = new Map<string, HabilidadeRegistro>(registros.map((registro) => [registro.id, registro]));
  const alteradas = habilidades.filter((habilidade) => {
    const atual = atuais.get(habilidade.id);
    return !atual || (Object.keys(habilidade) as (keyof HabilidadeRegistro)[]).some((campo) => atual[campo] !== habilidade[campo]);
  });

  for (let inicio = 0; inicio < alteradas.length; inicio += 500) {
    await prisma.$transaction(
      alteradas.slice(inicio, inicio + 500).map(({ id, ...dados }) =>
        prisma.bnccHabilidade.upsert({ where: { id }, create: { id, ...dados }, update: dados }),
      ),
    );
  }
  return alteradas.length;
}

async function main() {
  const { values } = parseArgs({
    options: { arquivo: { type: "string" }, forcar: { type: "boolean", default: false } },
  });
  const arquivo = values.arquivo ? resolve(values.arquivo) : ARQUIVO_PADRAO;
  const formato = extname(arquivo).toLowerCase() === ".csv" ? "csv" : "json";

  const { habilidades, avisos } = parseDataset(readFileSync(arquivo, "utf8"), formato);
  for (const aviso of avisos) console.warn(`[seed-bncc] ${aviso}`);
  if (habilidades.length === 0) throw new Error(`Nenhuma habilidade válida em ${arquivo}.`);
  console.log(`[seed-bncc] ${habilidades.length} habilidades lidas de ${arquivo}.`);

  const chaves = new Map(
    (await prisma.bnccHabilidade.findMany({ select: { id: true, embeddingKey: true } })).map((r) => [r.id, r.embeddingKey]),
  );
  const pendentes = habilidades
    .map((habilidade) => {
      const texto = textoParaEmbedding(habilidade);
      return { id: habilidade.id, texto, chave: embeddingKey(texto) };
    })
    .filter(({ id, chave }) => values.forcar || chaves.get(id) !== chave);

  if (pendentes.length > 0 && !isGeminiConfigured()) {
    console.error(
      "[seed-bncc] Defina GEMINI_API_KEY no .env para gerar os embeddings.\n" +
        "            Crie uma chave gratuita em https://aistudio.google.com/apikey e rode o comando de novo.",
    );
    process.exitCode = 1;
    return;
  }

  const salvas = await salvarTextos(habilidades);
  console.log(`[seed-bncc] Habilidades: ${salvas} nova(s) ou atualizada(s), ${habilidades.length - salvas} sem mudança.`);

  if (pendentes.length === 0) {
    console.log("[seed-bncc] Embeddings já estão em dia — nada a enviar para a API.");
    return;
  }

  console.log(`[seed-bncc] Gerando ${pendentes.length} embedding(s) com a API do Gemini...`);
  for (let inicio = 0; inicio < pendentes.length; inicio += LOTE) {
    const lote = pendentes.slice(inicio, inicio + LOTE);
    // No plano gratuito o Google pode pedir pausas de até ~1 min entre lotes: esperamos.
    const vetores = await gemini.embed(
      lote.map((item) => item.texto),
      { timeoutMs: 60_000, maxRetries: 5, maxRetryWaitMs: 90_000 },
    );
    await prisma.$transaction(
      lote.map((item, index) =>
        prisma.bnccHabilidade.update({
          where: { id: item.id },
          data: { embedding: vectorToBytes(vetores[index]!), embeddingKey: item.chave },
        }),
      ),
    );
    console.log(`[seed-bncc] Embeddings: ${inicio + lote.length}/${pendentes.length}`);
  }
  console.log("[seed-bncc] Pronto! O planejador BNCC já pode ser usado.");
}

main()
  .catch((error) => {
    if (error instanceof GeminiError) {
      console.error(`[seed-bncc] Erro do Gemini (${error.kind}): ${error.message}`);
      if (error.kind === "rate_limit") {
        console.error("[seed-bncc] O progresso foi salvo. Rode o comando de novo mais tarde para continuar.");
      }
    } else {
      console.error("[seed-bncc] Falhou:", error);
    }
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
