import "server-only";
import { timingSafeEqual } from "node:crypto";

const PLACEHOLDER = "troque-este-valor";

export function isApiKeyConfigured(): boolean {
  const key = process.env.AGENTE_BNCC_API_KEY?.trim();
  return Boolean(key) && key !== PLACEHOLDER;
}

/** Confere "Authorization: Bearer <AGENTE_BNCC_API_KEY>" em tempo constante. */
export function hasValidApiKey(request: Request): boolean {
  if (!isApiKeyConfigured()) return false;
  const expected = Buffer.from(process.env.AGENTE_BNCC_API_KEY!.trim());
  const header = request.headers.get("authorization") ?? "";
  const received = Buffer.from(/^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim() ?? "");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
