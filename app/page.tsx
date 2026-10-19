import { notFound } from "next/navigation";
import { PaginaAgente } from "@/components/bncc/pagina-agente";
import { Planner } from "@/components/bncc/planner";
import { getCalendarioComHabilidades } from "@/lib/bncc/calendario";
import { isDemoEnabled } from "@/lib/demo";
import { exigirSessao } from "@/lib/sessao-servidor";
import { getAgenteStatus } from "@/lib/status";

// Consulta o banco a cada acesso (o status muda depois do seed).
export const dynamic = "force-dynamic";

/** Página de demonstração dos planos de aula: usa o agente direto, sem chave de API. */
export default async function DemoPage() {
  if (!isDemoEnabled()) notFound();
  await exigirSessao("/");
  const status = await getAgenteStatus();
  const disciplinas = status.pronto ? await getCalendarioComHabilidades() : [];

  return (
    <PaginaAgente
      ativa="/"
      status={status}
      descricao="Escolha a disciplina, o ano e o bimestre e marque as habilidades: o agente monta o plano de aula com o texto oficial da BNCC para você revisar."
    >
      <Planner
        endpoint="/api/demo/planos"
        disciplinas={disciplinas}
        provedores={status.provedores}
      />
    </PaginaAgente>
  );
}
