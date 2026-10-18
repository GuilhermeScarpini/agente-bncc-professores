// GET /api/v1/calendario — disciplina → ano → bimestre → habilidades (código e texto oficial).
// Os mesmos menus das páginas do agente, para sistemas clientes (ex.: turma-social) montarem os seus.
// Público como o catálogo: são dados abertos da BNCC. A distribuição por bimestre vem de
// prisma/data/bncc-bimestres.json e só muda com um novo deploy, por isso pode ficar em cache.
import { success } from "@/lib/action-result";
import { getCalendarioComHabilidades } from "@/lib/bncc/calendario";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return Response.json(success(undefined, { disciplinas: await getCalendarioComHabilidades() }), {
    headers: { "Cache-Control": "public, max-age=300, s-maxage=3600" },
  });
}
