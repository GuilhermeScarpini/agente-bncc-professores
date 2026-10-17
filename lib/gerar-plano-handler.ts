// Tratamento comum de um pedido de plano: validação, limite de uso, chamada ao agente
// e tradução das falhas em respostas HTTP com mensagens em português.
import "server-only";
import { failure, success, validationFailure, type ActionResult } from "@/lib/action-result";
import { GeminiError } from "@/lib/ai/gemini";
import { BnccAgentError, bnccAgentService } from "@/lib/bncc/agent-service";
import type { PlanoGerado } from "@/lib/bncc/plano";
import { PlanoSemAncoragemError } from "@/lib/bncc/prompt";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit";
import { gerarPlanoSchema } from "@/lib/validation";

export function json<T>(body: ActionResult<T>, status = 200, retryAfterMs?: number): Response {
  const headers = retryAfterMs ? { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } : undefined;
  return Response.json(body, { status, headers });
}

function logFailure(error: unknown): void {
  if (error instanceof GeminiError) {
    if (error.kind !== "aborted") console.warn(`[agente-bncc] Gemini (${error.kind}): ${error.message}`);
  } else if (error instanceof BnccAgentError || error instanceof PlanoSemAncoragemError) {
    if (!(error instanceof BnccAgentError && error.kind === "sem_resultados")) {
      console.warn(`[agente-bncc] ${error.message}`);
    }
  } else {
    console.error("[agente-bncc] Falha inesperada ao gerar plano:", error);
  }
}

/** Traduz falhas da busca/geração em respostas que o professor entende. */
function errorResponse(error: unknown): Response {
  if (error instanceof BnccAgentError) {
    switch (error.kind) {
      case "base_vazia":
        return json(failure("A base da BNCC ainda não foi carregada no agente. Rode npm run db:seed-bncc."), 503);
      case "sem_resultados":
        return json(failure("Nenhuma habilidade da BNCC combina com esses filtros. Tente outro ano ou disciplina."), 422);
      case "resposta_invalida":
        return json(failure("A IA devolveu um plano incompleto. Tente gerar de novo."), 502);
    }
  }
  if (error instanceof PlanoSemAncoragemError) {
    return json(failure("Não foi possível ligar o tema às habilidades da BNCC. Tente descrever a aula de outro jeito."), 422);
  }
  if (error instanceof GeminiError) {
    switch (error.kind) {
      case "rate_limit": {
        const wait = error.retryAfterMs ?? 60_000;
        return json(failure(`O limite gratuito da IA foi atingido. Tente de novo em ${formatRetryAfter(wait)}.`), 429, wait);
      }
      case "timeout":
        return json(failure("A IA demorou demais para responder. Tente novamente."), 504);
      case "blocked":
        return json(failure("A IA não gerou este plano por causa dos filtros de segurança. Reformule o tema."), 422);
      case "config":
        return json(failure("O agente BNCC não está configurado: confira a GEMINI_API_KEY do agente."), 503);
      case "aborted":
        return json(failure("Geração cancelada."), 499);
      case "unavailable":
        return json(failure("O serviço de IA está fora do ar no momento. Tente daqui a pouco."), 503);
      case "invalid_response":
      case "bad_request":
        return json(failure("A IA devolveu uma resposta inesperada. Tente gerar de novo."), 502);
    }
  }
  return json(failure("Algo deu errado ao gerar o plano. Tente novamente."), 500);
}

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

export async function handleGerarPlano(request: Request, rateLimit: RateLimitOptions): Promise<Response> {
  // Exigir JSON impede envios de formulários de outros sites (eles não passam pelo CORS).
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return json(failure("Envie o corpo como JSON (Content-Type: application/json)."), 415);
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(failure("JSON inválido."), 400);
  }
  const parsed = gerarPlanoSchema.safeParse(body);
  if (!parsed.success) return json(validationFailure(parsed.error), 400);

  // Só pedidos válidos contam no limite.
  const limit = checkRateLimit(rateLimit.key, rateLimit.limit, rateLimit.windowMs);
  if (!limit.allowed) {
    return json(
      failure(`Muitos planos pedidos seguidos. Aguarde ${formatRetryAfter(limit.retryAfterMs)}.`),
      429,
      limit.retryAfterMs,
    );
  }

  try {
    const plano = await bnccAgentService.gerarPlano(parsed.data, { signal: request.signal });
    return json<PlanoGerado>(success(undefined, plano));
  } catch (error) {
    logFailure(error);
    return errorResponse(error);
  }
}
