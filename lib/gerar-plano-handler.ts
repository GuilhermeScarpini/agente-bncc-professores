// Tratamento comum de um pedido ao agente (plano ou prova): validação, limite de uso, chamada
// ao agente e tradução das falhas em respostas HTTP com mensagens em português.
import "server-only";
import type { z } from "zod";
import { failure, success, validationFailure, type ActionResult } from "@/lib/action-result";
import { LlmError } from "@/lib/ai/llm-error";
import { BnccAgentError, bnccAgentService } from "@/lib/bncc/agent-service";
import { PlanoSemAncoragemError } from "@/lib/bncc/prompt";
import { ProvaSemQuestoesError } from "@/lib/bncc/prompt-prova";
import { checkRateLimit, formatRetryAfter } from "@/lib/rate-limit";
import { gerarPlanoSchema, gerarProvaSchema, sugerirHabilidadesSchema } from "@/lib/validation";

export function json<T>(body: ActionResult<T>, status = 200, retryAfterMs?: number): Response {
  const headers = retryAfterMs ? { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } : undefined;
  return Response.json(body, { status, headers });
}

function logFailure(error: unknown): void {
  if (error instanceof LlmError) {
    if (error.kind !== "aborted") console.warn(`[agente-bncc] IA (${error.kind}): ${error.message}`);
  } else if (error instanceof BnccAgentError || error instanceof PlanoSemAncoragemError || error instanceof ProvaSemQuestoesError) {
    if (!(error instanceof BnccAgentError && error.kind === "sem_resultados")) {
      console.warn(`[agente-bncc] ${error.message}`);
    }
  } else {
    console.error("[agente-bncc] Falha inesperada ao gerar:", error);
  }
}

/** Traduz falhas da busca/geração em respostas que o professor entende. `oQue` = "o plano" ou "a prova". */
function errorResponse(error: unknown, oQue: string): Response {
  if (error instanceof BnccAgentError) {
    switch (error.kind) {
      case "base_vazia":
        return json(failure("A base da BNCC ainda não foi carregada no agente. Rode npm run db:seed-bncc."), 503);
      case "sem_resultados":
        return json(failure("Nenhuma habilidade da BNCC combina com esses filtros. Tente outro ano ou disciplina."), 422);
      case "habilidade_inexistente":
        return json(failure("Alguma das habilidades escolhidas não está carregada na base do agente."), 422);
      case "resposta_invalida":
        return json(failure("A IA devolveu uma resposta incompleta. Tente gerar de novo."), 502);
    }
  }
  if (error instanceof PlanoSemAncoragemError) {
    return json(failure("Não foi possível ligar o tema às habilidades da BNCC. Tente descrever a aula de outro jeito."), 422);
  }
  if (error instanceof ProvaSemQuestoesError) {
    return json(failure("A IA não devolveu questões válidas para essas habilidades. Tente gerar de novo."), 502);
  }
  if (error instanceof LlmError) {
    switch (error.kind) {
      case "rate_limit": {
        const wait = error.retryAfterMs ?? 60_000;
        return json(failure(`O limite de uso da IA foi atingido. Tente de novo em ${formatRetryAfter(wait)}.`), 429, wait);
      }
      case "no_credit":
        return json(failure("Os créditos da IA acabaram. Avise o administrador do agente BNCC."), 402);
      case "timeout":
        return json(failure("A IA demorou demais para responder. Tente novamente."), 504);
      case "blocked":
        return json(failure(`A IA não gerou ${oQue} por causa dos filtros de segurança. Reformule o pedido.`), 422);
      case "config":
        return json(failure("A IA do agente BNCC não está configurada: confira a chave e o modelo (GEMINI_* ou DEEPSEEK_*)."), 503);
      case "aborted":
        return json(failure("Geração cancelada."), 499);
      case "unavailable":
        return json(failure("O serviço de IA está fora do ar no momento. Tente daqui a pouco."), 503);
      case "invalid_response":
      case "bad_request":
        return json(failure("A IA devolveu uma resposta inesperada. Tente gerar de novo."), 502);
    }
  }
  return json(failure(`Algo deu errado ao gerar ${oQue}. Tente novamente.`), 500);
}

interface RateLimitOptions {
  key: string;
  limit: number;
  windowMs: number;
}

interface Geracao<TPedido, TResultado> {
  schema: z.ZodType<TPedido>;
  gerar: (pedido: TPedido, options: { signal?: AbortSignal }) => Promise<TResultado>;
  oQue: string;
}

async function handleGeracao<TPedido, TResultado>(
  request: Request,
  rateLimit: RateLimitOptions,
  geracao: Geracao<TPedido, TResultado>,
): Promise<Response> {
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
  const parsed = geracao.schema.safeParse(body);
  if (!parsed.success) return json(validationFailure(parsed.error), 400);

  // Só pedidos válidos contam no limite. Planos e provas dividem o mesmo limite (a mesma cota do Gemini).
  const limit = checkRateLimit(rateLimit.key, rateLimit.limit, rateLimit.windowMs);
  if (!limit.allowed) {
    return json(
      failure(`Muitos pedidos seguidos. Aguarde ${formatRetryAfter(limit.retryAfterMs)}.`),
      429,
      limit.retryAfterMs,
    );
  }

  try {
    const resultado = await geracao.gerar(parsed.data, { signal: request.signal });
    return json<TResultado>(success(undefined, resultado));
  } catch (error) {
    logFailure(error);
    return errorResponse(error, geracao.oQue);
  }
}

export function handleGerarPlano(request: Request, rateLimit: RateLimitOptions): Promise<Response> {
  return handleGeracao(request, rateLimit, { schema: gerarPlanoSchema, gerar: bnccAgentService.gerarPlano, oQue: "o plano" });
}

export function handleGerarProva(request: Request, rateLimit: RateLimitOptions): Promise<Response> {
  return handleGeracao(request, rateLimit, { schema: gerarProvaSchema, gerar: bnccAgentService.gerarProva, oQue: "a prova" });
}

/** Habilidades da BNCC para uma questão escrita à mão (busca semântica, sem gerar texto). */
export function handleSugerirHabilidades(request: Request, rateLimit: RateLimitOptions): Promise<Response> {
  return handleGeracao(request, rateLimit, {
    schema: sugerirHabilidadesSchema,
    gerar: bnccAgentService.sugerirHabilidades,
    oQue: "a busca",
  });
}
