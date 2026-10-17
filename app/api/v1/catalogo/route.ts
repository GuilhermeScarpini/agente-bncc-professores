// GET /api/v1/catalogo — opções de disciplina e ano escolar aceitas por POST /api/v1/planos.
import { success } from "@/lib/action-result";
import { ANOS_ESCOLARES, GRUPOS_DE_COMPONENTES } from "@/lib/bncc/codigos";

export function GET(): Response {
  return Response.json(
    success(undefined, {
      componentes: GRUPOS_DE_COMPONENTES,
      anosEscolares: ANOS_ESCOLARES.map(({ value, label }) => ({ value, label })),
    }),
  );
}
