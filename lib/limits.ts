// Limites compartilhados entre validação (servidor) e formulário (navegador).
export const LIMITS = {
  tema: 500,
  /** Orientações livres do professor para complementar o plano. */
  complemento: 500,
  /** Habilidades que o professor pode escolher na lista para um mesmo plano. */
  habilidades: 5,
} as const;
