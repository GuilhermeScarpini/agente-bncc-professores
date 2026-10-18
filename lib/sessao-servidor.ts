import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_SESSAO, modoDeAcesso, tokenSessaoValido } from "./sessao";

/** A pessoa pode usar as páginas de planos e provas (e as rotas /api/demo que elas chamam). */
export async function sessaoAtiva(): Promise<boolean> {
  const modo = modoDeAcesso();
  if (modo !== "senha") return modo === "aberto";
  return tokenSessaoValido((await cookies()).get(COOKIE_SESSAO)?.value);
}

/** Nas páginas: sem sessão, manda para o login e volta para `caminho` depois. */
export async function exigirSessao(caminho: string): Promise<void> {
  if (!(await sessaoAtiva())) redirect(`/entrar?voltar=${encodeURIComponent(caminho)}`);
}
