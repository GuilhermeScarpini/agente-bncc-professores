import { notFound } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { Planner } from "@/components/bncc/planner";
import { Alert } from "@/components/ui/alert";
import { isDemoEnabled } from "@/lib/demo";
import { getAgenteStatus } from "@/lib/status";

// Consulta o banco a cada acesso (o status muda depois do seed).
export const dynamic = "force-dynamic";

/** Página de demonstração: usa o agente direto, sem chave de API. */
export default async function DemoPage() {
  if (!isDemoEnabled()) notFound();
  const status = await getAgenteStatus();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4 px-4 py-8 sm:py-12">
      <header className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
          <GraduationCap className="size-6" aria-hidden />
        </span>
        <div className="space-y-0.5">
          <h1 className="text-xl font-extrabold tracking-tight">Agente BNCC</h1>
          <p className="text-sm text-muted-foreground">
            Descreva o tema: o agente busca as habilidades oficiais da BNCC e monta um plano de aula para você revisar.
          </p>
        </div>
      </header>

      <section className="rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
        {status.pronto ? (
          <Planner endpoint="/api/demo/planos" />
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
        {status.habilidades} habilidades carregadas · busca com {status.modeloEmbedding} · geração com{" "}
        {status.modeloGeracao}
      </p>
    </main>
  );
}
