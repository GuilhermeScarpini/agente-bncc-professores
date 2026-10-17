// GET /api/v1/status — prontidão do agente (público: serve de health check).
import { success } from "@/lib/action-result";
import { getAgenteStatus } from "@/lib/status";

export async function GET(): Promise<Response> {
  return Response.json(success(undefined, await getAgenteStatus()));
}
