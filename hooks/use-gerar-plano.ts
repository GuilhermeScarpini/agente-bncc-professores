"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult, FieldErrors } from "@/lib/action-result";
import type { PlanoGerado } from "@/lib/bncc/plano";

export interface PedidoPlano {
  tema: string;
  componente: string;
  anoEscolar: string;
}

interface State {
  plano: PlanoGerado | null;
  pending: boolean;
  error: string | null;
  fieldErrors?: FieldErrors;
}

const INITIAL: State = { plano: null, pending: false, error: null };

/**
 * Pede um plano ao endpoint informado. A geração pode ser cancelada (o servidor também
 * interrompe a chamada ao Gemini) e, se for, o plano anterior continua na tela.
 */
export function useGerarPlano(endpoint: string) {
  const [state, setState] = useState<State>(INITIAL);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const gerar = useCallback(
    async (pedido: PedidoPlano) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState((current) => ({ ...current, pending: true, error: null, fieldErrors: undefined }));

      let next: Partial<State>;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pedido),
          signal: controller.signal,
        });
        if (!response.headers.get("content-type")?.includes("application/json")) {
          next = { error: "Não foi possível gerar o plano agora. Tente novamente." };
        } else {
          const result = (await response.json()) as ActionResult<PlanoGerado>;
          next = result.ok
            ? { plano: result.data ?? null, error: result.data ? null : "O servidor devolveu um plano vazio." }
            : { error: result.error, fieldErrors: result.fieldErrors };
        }
      } catch {
        next = controller.signal.aborted ? {} : { error: "Sem conexão com o servidor. Confira a internet e tente de novo." };
      }

      // Um pedido mais novo assumiu: o estado agora é dele.
      if (controllerRef.current !== controller) return;
      controllerRef.current = null;
      setState((current) => ({ ...current, ...next, pending: false }));
    },
    [endpoint],
  );

  const cancelar = useCallback(() => controllerRef.current?.abort(), []);

  return { ...state, gerar, cancelar };
}
