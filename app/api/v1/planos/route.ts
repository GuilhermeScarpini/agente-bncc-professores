// POST /api/v1/planos — gera um plano de aula ancorado na BNCC.
// Para sistemas clientes (ex.: turma-social): exige "Authorization: Bearer <AGENTE_BNCC_API_KEY>".
import { failure } from "@/lib/action-result";
import { hasValidApiKey } from "@/lib/api-key";
import { handleGerarPlano, json } from "@/lib/gerar-plano-handler";

export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  if (!hasValidApiKey(request)) {
    const response = json(failure("Chave de API ausente ou inválida."), 401);
    response.headers.set("WWW-Authenticate", "Bearer");
    return response;
  }
  // Os clientes aplicam o limite por usuário; este protege a cota do Gemini como um todo.
  return handleGerarPlano(request, { key: "api", limit: 30, windowMs: 10 * 60_000 });
}
