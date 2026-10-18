"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { COOKIE_SESSAO, DURACAO_SESSAO_MS, conferirSenha, criarTokenSessao, destinoSeguro } from "@/lib/sessao";

/** Confere a senha e abre a sessão por 30 dias. Errou: volta ao formulário com o aviso. */
export async function entrar(formData: FormData): Promise<void> {
  const voltar = destinoSeguro(formData.get("voltar"));
  const tentativa = checkRateLimit(`login:${await getClientIp()}`, 10, 15 * 60_000);
  if (!tentativa.allowed) redirect(`/entrar?erro=limite&voltar=${encodeURIComponent(voltar)}`);

  const senha = formData.get("senha");
  if (typeof senha !== "string" || !conferirSenha(senha)) {
    redirect(`/entrar?erro=senha&voltar=${encodeURIComponent(voltar)}`);
  }

  (await cookies()).set(COOKIE_SESSAO, criarTokenSessao(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DURACAO_SESSAO_MS / 1000,
  });
  redirect(voltar);
}

export async function sair(): Promise<void> {
  (await cookies()).delete(COOKIE_SESSAO);
  redirect("/entrar");
}
