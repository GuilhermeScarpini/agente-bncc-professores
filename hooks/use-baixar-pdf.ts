"use client";

import { useCallback, useState } from "react";

/** Salva os bytes como arquivo no computador do professor. */
function salvarArquivo(bytes: Uint8Array, nome: string): void {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nome;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Gera um PDF no navegador e baixa. `qual` identifica o botão, para só ele mostrar "Gerando…".
 * O gerador é carregado sob demanda (o pdf-lib só entra quando alguém baixa).
 */
export function useBaixarPdf() {
  const [gerando, setGerando] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const baixar = useCallback(async (qual: string, gerar: () => Promise<Uint8Array>, nome: string) => {
    setGerando(qual);
    setErro(null);
    try {
      salvarArquivo(await gerar(), nome);
    } catch (error) {
      console.error("[agente-bncc] Falha ao gerar o PDF:", error);
      setErro("Não foi possível gerar o PDF. Tente de novo.");
    } finally {
      setGerando(null);
    }
  }, []);

  return { gerando, erro, baixar };
}
