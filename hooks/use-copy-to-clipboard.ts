"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Copia texto para a área de transferência e indica "copiado" por 2 segundos. Com `html`, copia
 * também a versão formatada (com imagens), que editores como Word e Google Docs colam no lugar do
 * texto simples; se o navegador não aceitar, copia só o texto.
 */
export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const copy = useCallback(async (text: string, html?: string): Promise<boolean> => {
    try {
      if (html && typeof ClipboardItem !== "undefined") {
        try {
          await navigator.clipboard.write([
            new ClipboardItem({
              "text/html": new Blob([html], { type: "text/html" }),
              "text/plain": new Blob([text], { type: "text/plain" }),
            }),
          ]);
        } catch {
          await navigator.clipboard.writeText(text);
        }
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      return false;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 2000);
    return true;
  }, []);

  return { copied, copy };
}
