"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult, FieldErrors } from "@/lib/action-result";
import type { PlanoGerado } from "@/lib/bncc/plano";
import type { FormatoProva, ProvaGerada } from "@/lib/bncc/prova";

/** Corpo de POST /api/v1/planos: um tema livre ou habilidades escolhidas na lista. */
export interface PedidoPlano {
  tema?: string;
  habilidades?: string[];
  complemento?: string;
  componente?: string;
  anoEscolar?: string;
  bimestre?: string;
}

/** Corpo de POST /api/v1/provas. */
export interface PedidoProva extends PedidoPlano {
  quantidade?: number;
  formato?: FormatoProva;
}

interface State<T> {
  resultado: T | null;
  pending: boolean;
  error: string | null;
  fieldErrors?: FieldErrors;
}

/**
 * Pede uma geração (plano ou prova) ao endpoint informado. Pode ser cancelada (o servidor também
 * interrompe a chamada ao Gemini) e, se for, o resultado anterior continua na tela.
 */
export function useGeracao<TPedido, TResultado>(endpoint: string, oQue: string) {
  const [state, setState] = useState<State<TResultado>>({ resultado: null, pending: false, error: null });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const gerar = useCallback(
    async (pedido: TPedido) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      setState((current) => ({ ...current, pending: true, error: null, fieldErrors: undefined }));

      let next: Partial<State<TResultado>>;
      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(pedido),
          signal: controller.signal,
        });
        if (!response.headers.get("content-type")?.includes("application/json")) {
          next = { error: `Não foi possível gerar ${oQue} agora. Tente novamente.` };
        } else {
          const result = (await response.json()) as ActionResult<TResultado>;
          next = result.ok
            ? { resultado: result.data ?? null, error: result.data ? null : "O servidor devolveu uma resposta vazia." }
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
    [endpoint, oQue],
  );

  const cancelar = useCallback(() => controllerRef.current?.abort(), []);

  return { ...state, gerar, cancelar };
}

export function useGerarPlano(endpoint: string) {
  const { resultado, ...resto } = useGeracao<PedidoPlano, PlanoGerado>(endpoint, "o plano");
  return { plano: resultado, ...resto };
}

export function useGerarProva(endpoint: string) {
  const { resultado, ...resto } = useGeracao<PedidoProva, ProvaGerada>(endpoint, "a prova");
  return { prova: resultado, ...resto };
}
