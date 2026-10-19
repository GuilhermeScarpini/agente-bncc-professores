// Erro tipado das IAs de geração (Gemini e DeepSeek): o tratamento das rotas olha só o `kind`,
// então a mensagem para o professor é a mesma qualquer que seja a IA.

export type LlmErrorKind =
  | "config" // chave ausente/inválida ou modelo inexistente
  | "rate_limit" // cota esgotada ou excesso de pedidos (429)
  | "no_credit" // saldo pré-pago acabou (DeepSeek, 402)
  | "timeout"
  | "unavailable" // rede ou servidor da IA fora do ar
  | "blocked" // filtros de segurança da IA
  | "invalid_response"
  | "bad_request"
  | "aborted"; // cancelado por quem chamou

export class LlmError extends Error {
  constructor(
    readonly kind: LlmErrorKind,
    message: string,
    /** Quanto esperar antes de tentar de novo, quando a IA informa (429). */
    readonly retryAfterMs?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LlmError";
  }
}

/** Espera que pode ser cancelada (o professor fechou a janela). */
export function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

export function backoffMs(attempt: number): number {
  return 1000 * 2 ** attempt + Math.floor(Math.random() * 250);
}
