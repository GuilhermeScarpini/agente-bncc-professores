// Rota da página de demonstração ("/"): sem chave, limitada por IP.
// Desligue com DEMO_HABILITADA="false" quando o agente estiver exposto na internet.
import { failure } from "@/lib/action-result";
import { isDemoEnabled } from "@/lib/demo";
import { handleGerarPlano, json } from "@/lib/gerar-plano-handler";
import { getClientIp } from "@/lib/rate-limit";

export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  if (!isDemoEnabled()) return json(failure("Demonstração desativada."), 404);
  return handleGerarPlano(request, { key: `demo:${await getClientIp()}`, limit: 5, windowMs: 10 * 60_000 });
}
