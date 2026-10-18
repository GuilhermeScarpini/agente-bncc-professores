// Rota da página de demonstração de provas ("/provas"): sem chave da API, mas com a senha de acesso (ACESSO_SENHA) e limitada por IP.
// Desligue as páginas com DEMO_HABILITADA="false" se o agente for usado só como API.
import { failure } from "@/lib/action-result";
import { isDemoEnabled } from "@/lib/demo";
import { handleGerarProva, json } from "@/lib/gerar-plano-handler";
import { getClientIp } from "@/lib/rate-limit";
import { sessaoAtiva } from "@/lib/sessao-servidor";

export const maxDuration = 120;

export async function POST(request: Request): Promise<Response> {
  if (!isDemoEnabled()) return json(failure("Demonstração desativada."), 404);
  if (!(await sessaoAtiva())) return json(failure("Entre com a senha de acesso para gerar."), 401);
  return handleGerarProva(request, { key: `demo:${await getClientIp()}`, limit: 5, windowMs: 10 * 60_000 });
}
