import { z } from "zod";
import { BIMESTRES } from "./bncc/bimestres";
import { ANOS_ESCOLARES_VALORES, COMPONENTES, findAnoEscolar, parseCodigoBncc } from "./bncc/codigos";
import { FORMATOS_PROVA, QUESTOES } from "./bncc/prova";
import { LIMITS } from "./limits";

/** Campo de escolha opcional: vazio vira undefined. */
function optionalChoice<const T extends readonly [string, ...string[]]>(values: T, message: string) {
  return z.preprocess((value) => (value === "" || value === null ? undefined : value), z.enum(values, message).optional());
}

/** Texto opcional: só espaços vira undefined. */
function optionalText(schema: z.ZodString) {
  return z.preprocess(
    (value) => (value === null || (typeof value === "string" && value.trim() === "") ? undefined : value),
    schema.optional(),
  );
}

/** Campos comuns a planos e provas: um tema livre ou habilidades escolhidas na lista. */
const pedidoBase = z.object({
  tema: optionalText(
    z
      .string("Conte o que você quer trabalhar na aula.")
      .trim()
      .min(3, "Conte em poucas palavras o que você quer trabalhar na aula.")
      .max(LIMITS.tema, `O tema pode ter no máximo ${LIMITS.tema} caracteres.`),
  ),
  habilidades: z.preprocess(
    (value) => (Array.isArray(value) && value.length === 0 ? undefined : value),
    z
      .array(z.string("Código de habilidade inválido.").trim().toUpperCase(), "Envie os códigos das habilidades numa lista.")
      .max(LIMITS.habilidades, `Escolha no máximo ${LIMITS.habilidades} habilidades.`)
      .optional(),
  ),
  complemento: optionalText(
    z
      .string("O complemento precisa ser um texto.")
      .trim()
      .max(LIMITS.complemento, `O complemento pode ter no máximo ${LIMITS.complemento} caracteres.`),
  ),
  componente: optionalChoice(COMPONENTES, "Escolha uma disciplina da lista."),
  anoEscolar: optionalChoice(ANOS_ESCOLARES_VALORES, "Escolha um ano escolar da lista."),
  bimestre: z.preprocess(
    (value) => (typeof value === "number" ? String(value) : value),
    optionalChoice(BIMESTRES, "Escolha um bimestre de 1 a 4."),
  ),
});

/** Confere tema ou habilidades, e cada habilidade contra a disciplina e o ano. */
function conferirHabilidades(pedido: z.infer<typeof pedidoBase>, ctx: z.RefinementCtx): void {
  if (!pedido.habilidades) {
    if (!pedido.tema) {
      ctx.addIssue({ code: "custom", path: ["tema"], message: "Escolha uma habilidade da lista ou conte o tema da aula." });
    }
    return;
  }
  const issue = (message: string) => ctx.addIssue({ code: "custom", path: ["habilidades"], message });
  if (new Set(pedido.habilidades).size !== pedido.habilidades.length) issue("Há habilidades repetidas na lista.");
  const ano = findAnoEscolar(pedido.anoEscolar);
  for (const codigo of pedido.habilidades) {
    const info = parseCodigoBncc(codigo);
    if (!info) issue(`"${codigo}" não é um código de habilidade da BNCC.`);
    else if (pedido.componente && pedido.componente !== info.componente) issue(`${codigo} é de ${info.componente}.`);
    else if (ano && (ano.fim < info.anoInicio || ano.inicio > info.anoFim)) {
      issue(`${codigo} não é do ano escolhido (vale para ${info.anoFaixa}).`);
    }
  }
}

/** Corpo de POST /api/v1/planos. */
export const gerarPlanoSchema = pedidoBase.superRefine(conferirHabilidades);

/** Corpo de POST /api/v1/provas: os campos do plano, mais quantidade de questões e formato. */
export const gerarProvaSchema = pedidoBase
  .extend({
    quantidade: z.preprocess(
      (value) => (value === undefined || value === null || value === "" ? QUESTOES.padrao : Number(value)),
      z
        .number("Informe o número de questões.")
        .int("O número de questões precisa ser inteiro.")
        .min(QUESTOES.minimo, `A prova precisa ter ao menos ${QUESTOES.minimo} questões.`)
        .max(QUESTOES.maximo, `A prova pode ter no máximo ${QUESTOES.maximo} questões.`),
    ),
    formato: z.preprocess(
      (value) => (value === undefined || value === null || value === "" ? "mista" : value),
      z.enum(FORMATOS_PROVA, "Escolha o formato: mista, objetivas ou discursivas."),
    ),
  })
  .superRefine(conferirHabilidades);

export type PedidoPlanoValidado = z.infer<typeof gerarPlanoSchema>;
export type PedidoProvaValidado = z.infer<typeof gerarProvaSchema>;
