// Cria o arquivo .env a partir do .env.example na primeira execução,
// gerando uma AGENTE_BNCC_API_KEY aleatória. Nunca sobrescreve um .env existente.
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const envPath = resolve(root, ".env");
const examplePath = resolve(root, ".env.example");

if (existsSync(envPath)) {
  process.exit(0);
}

if (!existsSync(examplePath)) {
  console.error("[setup-env] .env.example não encontrado.");
  process.exit(1);
}

const apiKey = randomBytes(32).toString("base64url");
const content = readFileSync(examplePath, "utf8").replace(
  /^AGENTE_BNCC_API_KEY=.*$/m,
  `AGENTE_BNCC_API_KEY="${apiKey}"`,
);

writeFileSync(envPath, content, "utf8");
console.log("[setup-env] Arquivo .env criado com uma AGENTE_BNCC_API_KEY aleatória.");
