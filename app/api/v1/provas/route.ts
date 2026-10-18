// POST /api/v1/provas — gera uma prova com gabarito ancorada na BNCC.
// Para sistemas clientes (ex.: turma-social): exige "Authorization: Bearer <AGENTE_BNCC_API_KEY>".
import { failure } from "@/lib/action-result";
import { hasValidApiKey } from "@/lib/api-key";
import { handleGerarProva, json } from "@/lib/gerar-plano-handler";

export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  if (!hasValidApiKey(request)) {
    const response = json(failure("Chave de API ausente ou inválida."), 401);
    response.headers.set("WWW-Authenticate", "Bearer");
    return response;
  }
  // Mesmo limite (e mesma chave de limite) dos planos: os dois gastam a mesma cota do Gemini.
  return handleGerarProva(request, { key: "api", limit: 30, windowMs: 10 * 60_000 });
}
