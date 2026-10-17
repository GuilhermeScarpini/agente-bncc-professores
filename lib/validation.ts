import { z } from "zod";
import { ANOS_ESCOLARES_VALORES, COMPONENTES } from "./bncc/codigos";
import { LIMITS } from "./limits";

/** Campo de escolha opcional: vazio vira undefined. */
function optionalChoice(values: readonly [string, ...string[]], message: string) {
  return z.preprocess((value) => (value === "" || value === null ? undefined : value), z.enum(values, message).optional());
}

/** Corpo de POST /api/v1/planos. */
export const gerarPlanoSchema = z.object({
  tema: z
    .string("Conte o que você quer trabalhar na aula.")
    .trim()
    .min(3, "Conte em poucas palavras o que você quer trabalhar na aula.")
    .max(LIMITS.tema, `O tema pode ter no máximo ${LIMITS.tema} caracteres.`),
  componente: optionalChoice(COMPONENTES, "Escolha uma disciplina da lista."),
  anoEscolar: optionalChoice(ANOS_ESCOLARES_VALORES, "Escolha um ano escolar da lista."),
});
