import { GraduationCap, LogOut } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { sair } from "@/app/entrar/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { modoDeAcesso } from "@/lib/sessao";
import type { AgenteStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

const ABAS = [
  { href: "/", rotulo: "Planos de aula" },
  { href: "/provas", rotulo: "Provas" },
] as const;

interface PaginaAgenteProps {
  ativa: (typeof ABAS)[number]["href"];
  descricao: ReactNode;
  status: AgenteStatus;
  /** Conteúdo quando o agente está pronto. */
  children: ReactNode;
}

/** Moldura das páginas de demonstração: cabeçalho, abas, avisos de configuração e rodapé com os modelos. */
export function PaginaAgente({ ativa, descricao, status, children }: PaginaAgenteProps) {
  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-8 sm:py-12">
      <header className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <GraduationCap className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <h1 className="text-xl font-extrabold tracking-tight">Agente BNCC</h1>
          <p className="text-sm text-muted-foreground">{descricao}</p>
        </div>
        {modoDeAcesso() === "senha" ? (
          <form action={sair}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="size-4" aria-hidden />
              Sair
            </Button>
          </form>
        ) : null}
      </header>

      <nav aria-label="O que gerar" className="flex gap-1 rounded-xl bg-secondary p-1">
        {ABAS.map((aba) => (
          <Link
            key={aba.href}
            href={aba.href}
            aria-current={aba.href === ativa ? "page" : undefined}
            className={cn(
              "flex-1 rounded-lg px-3 py-1.5 text-center text-sm font-semibold transition-colors",
              aba.href === ativa ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {aba.rotulo}
          </Link>
        ))}
      </nav>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        {status.pronto ? (
          children
        ) : !status.configurado ? (
          <Alert variant="info" title="O agente ainda não foi configurado">
            Defina <code>GEMINI_API_KEY</code> no <code>.env</code> (a chave é gratuita em aistudio.google.com/apikey),
            reinicie o servidor e rode <code>npm run db:seed-bncc</code>.
          </Alert>
        ) : (
          <Alert variant="info" title="Falta carregar a BNCC">
            Rode <code>npm run db:seed-bncc</code> para carregar as habilidades. Leva poucos minutos e só precisa ser
            feito uma vez.
          </Alert>
        )}
      </section>

      <p className="px-1 text-xs text-muted-foreground">
        {status.habilidades} habilidades carregadas · busca com {status.modeloEmbedding}
      </p>
    </main>
  );
}
