import { z } from "zod";

export type FieldErrors = Record<string, string[] | undefined>;

export type ActionSuccess<T> = { ok: true; message?: string; data?: T };
export type ActionFailure = { ok: false; error: string; fieldErrors?: FieldErrors };

/** Resultado padronizado de todas as Server Actions (consumido por useActionState). */
export type ActionResult<T = void> = ActionSuccess<T> | ActionFailure;

export function success<T = void>(message?: string, data?: T): ActionSuccess<T> {
  return { ok: true, message, data };
}

export function failure(error: string, fieldErrors?: FieldErrors): ActionFailure {
  return { ok: false, error, fieldErrors };
}

export function validationFailure(error: z.ZodError): ActionFailure {
  const { fieldErrors } = z.flattenError(error);
  return failure(error.issues[0]?.message ?? "Dados inválidos.", fieldErrors as FieldErrors);
}
