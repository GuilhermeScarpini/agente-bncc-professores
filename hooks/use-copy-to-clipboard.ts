"use client";

import { useCallback, useRef, useState } from "react";

/** Copia texto para a área de transferência e indica "copiado" por 2 segundos. */
export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  const copy = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
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
