import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { GraduationCap, LockKeyhole } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { destinoSeguro, modoDeAcesso } from "@/lib/sessao";
import { sessaoAtiva } from "@/lib/sessao-servidor";
import { entrar } from "./actions";

export const metadata: Metadata = { title: "Entrar · Agente BNCC" };

const ERROS: Record<string, string> = {
  senha: "Senha incorreta. Confira e tente de novo.",
  limite: "Muitas tentativas seguidas. Aguarde 15 minutos e tente de novo.",
};

export default async function EntrarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { voltar: voltarParam, erro } = await searchParams;
  const voltar = destinoSeguro(voltarParam);
  const modo = modoDeAcesso();
  if (await sessaoAtiva()) redirect(voltar);
  const mensagem = typeof erro === "string" ? ERROS[erro] : undefined;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-4 px-4 py-8">
      <header className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <GraduationCap className="size-6" aria-hidden />
        </span>
        <div>
          <h1 className="text-xl font-extrabold tracking-tight">Agente BNCC</h1>
          <p className="text-sm text-muted-foreground">Planos de aula e provas a partir da BNCC.</p>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        {modo === "bloqueado" ? (
          <Alert variant="info" title="Acesso ainda não configurado">
            Defina <code>ACESSO_SENHA</code> nas variáveis de ambiente do servidor (na Vercel: Settings → Environment
            Variables) e publique de novo.
          </Alert>
        ) : (
          <form action={entrar} className="space-y-4">
            <input type="hidden" name="voltar" value={voltar} />
            <Field label="Senha de acesso" htmlFor="senha" error={mensagem}>
              <Input
                id="senha"
                name="senha"
                type="password"
                autoComplete="current-password"
                required
                autoFocus
                aria-invalid={mensagem ? true : undefined}
              />
            </Field>
            <Button type="submit" className="w-full">
              <LockKeyhole className="size-4" aria-hidden />
              Entrar
            </Button>
          </form>
        )}
      </section>
    </main>
  );
}
