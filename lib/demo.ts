/** Página de demonstração em "/" (desligue com DEMO_HABILITADA="false"). */
export function isDemoEnabled(): boolean {
  return process.env.DEMO_HABILITADA?.trim().toLowerCase() !== "false";
}
