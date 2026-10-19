// Busca da habilidade da BNCC para uma questão que o professor escreveu à mão na página de provas.
// Usa a mesma sessão das outras rotas de demonstração e tem um limite próprio: cada busca gasta um
// embedding do Gemini, mas nenhuma geração.
import { failure } from "@/lib/action-result";
import { isDemoEnabled } from "@/lib/demo";
import { handleSugerirHabilidades, json } from "@/lib/gerar-plano-handler";
import { getClientIp } from "@/lib/rate-limit";
import { sessaoAtiva } from "@/lib/sessao-servidor";

export const maxDuration = 30;

export async function POST(request: Request): Promise<Response> {
  if (!isDemoEnabled()) return json(failure("Demonstração desativada."), 404);
  if (!(await sessaoAtiva())) return json(failure("Entre com a senha de acesso para procurar."), 401);
  return handleSugerirHabilidades(request, { key: `demo-busca:${await getClientIp()}`, limit: 30, windowMs: 10 * 60_000 });
}
