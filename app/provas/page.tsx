import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GeradorDeProvas } from "@/components/bncc/gerador-de-provas";
import { PaginaAgente } from "@/components/bncc/pagina-agente";
import { getCalendarioComHabilidades } from "@/lib/bncc/calendario";
import { isDemoEnabled } from "@/lib/demo";
import { exigirSessao } from "@/lib/sessao-servidor";
import { getAgenteStatus } from "@/lib/status";

export const metadata: Metadata = { title: "Provas · Agente BNCC" };

// Consulta o banco a cada acesso (o status muda depois do seed).
export const dynamic = "force-dynamic";

/** Página de demonstração das provas: usa o agente direto, sem chave de API. */
export default async function ProvasPage() {
  if (!isDemoEnabled()) notFound();
  await exigirSessao("/provas");
  const status = await getAgenteStatus();
  const disciplinas = status.pronto ? await getCalendarioComHabilidades() : [];

  return (
    <PaginaAgente
      ativa="/provas"
      status={status}
      descricao="Escolha a disciplina, o ano e o bimestre e marque as habilidades: o agente monta a prova com gabarito a partir do texto oficial da BNCC para você revisar."
    >
      <GeradorDeProvas
        endpoint="/api/demo/provas"
        disciplinas={disciplinas}
        provedores={status.provedores}
      />
    </PaginaAgente>
  );
}
