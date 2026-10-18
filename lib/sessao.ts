// Acesso às páginas de planos e provas por senha (ACESSO_SENHA). A sessão é um cookie
// assinado com HMAC ("<expira em ms>.<assinatura>"): não precisa de banco e vale em qualquer
// instância do servidor. A API v1 não usa isto: ela continua exigindo a AGENTE_BNCC_API_KEY.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const COOKIE_SESSAO = "agente_bncc_sessao";
export const DURACAO_SESSAO_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * - "senha": ACESSO_SENHA definida, as páginas pedem login;
 * - "aberto": sem senha em desenvolvimento (npm run dev), para não atrapalhar quem programa;
 * - "bloqueado": sem senha em produção, as páginas ficam fechadas até alguém definir a senha.
 */
export type ModoDeAcesso = "senha" | "aberto" | "bloqueado";

function senhaDefinida(): string | undefined {
  return process.env.ACESSO_SENHA?.trim() || undefined;
}

export function modoDeAcesso(): ModoDeAcesso {
  if (senhaDefinida()) return "senha";
  return process.env.NODE_ENV === "production" ? "bloqueado" : "aberto";
}

/** Trocar a senha (ou a chave da API) invalida todas as sessões abertas. */
function assinar(texto: string): string {
  const segredo = `${senhaDefinida() ?? ""}:${process.env.AGENTE_BNCC_API_KEY ?? ""}`;
  return createHmac("sha256", segredo).update(texto).digest("base64url");
}

function iguais(a: string, b: string): boolean {
  // Compara resumos de mesmo tamanho, em tempo constante.
  return timingSafeEqual(createHash("sha256").update(a).digest(), createHash("sha256").update(b).digest());
}

export function conferirSenha(tentativa: string): boolean {
  const senha = senhaDefinida();
  return Boolean(senha) && iguais(tentativa.trim(), senha!);
}

export function criarTokenSessao(agora = Date.now()): string {
  const expira = String(agora + DURACAO_SESSAO_MS);
  return `${expira}.${assinar(expira)}`;
}

export function tokenSessaoValido(token: string | undefined, agora = Date.now()): boolean {
  if (!token || !senhaDefinida()) return false;
  const [expira = "", assinatura = ""] = token.split(".");
  return /^\d+$/.test(expira) && Number(expira) > agora && iguais(assinatura, assinar(expira));
}

/** Destino depois do login: só caminhos deste site ("/provas"), nunca outro domínio ("//site.com"). */
export function destinoSeguro(valor: unknown): string {
  return typeof valor === "string" && /^\/(?![/\\])/.test(valor) ? valor : "/";
}
