"use client";

// Qual IA gera o plano ou a prova: DeepSeek (a recomendada, com a escolha do modelo) ou Gemini
// (no modelo padrão do agente). Uma IA sem chave no .env aparece desabilitada.
import { Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_DEEPSEEK_MODEL, type DeepSeekModel, type LlmProvider } from "@/lib/ai/providers";
import type { AgenteStatus } from "@/lib/status";
import { cn } from "@/lib/utils";

export type ProvedoresDaIa = AgenteStatus["provedores"];

const MODELOS_DEEPSEEK: { valor: DeepSeekModel; nome: string; descricao: string; recomendado?: boolean }[] = [
  {
    valor: "deepseek-flash",
    nome: "DeepSeek Flash",
    descricao: "Mais rápido (10 a 15 s). Dá conta de planos e provas do Fundamental I.",
    recomendado: true,
  },
  {
    valor: "deepseek-v4-pro",
    nome: "DeepSeek V4 Pro",
    descricao: "Explicações mais detalhadas, mas mais lento (cerca de 40 s).",
  },
];

/** A página começa no DeepSeek, o recomendado; sem a chave dele, no Gemini. */
export function useEscolhaIa(provedores: ProvedoresDaIa) {
  const [llm, setLlm] = useState<LlmProvider>(() =>
    provedores.deepseek.configurado || !provedores.gemini.configurado ? "deepseek" : "gemini",
  );
  const [modeloDeepSeek, setModeloDeepSeek] = useState<DeepSeekModel>(DEFAULT_DEEPSEEK_MODEL);

  return {
    provedores,
    llm,
    modeloDeepSeek,
    escolherIa: setLlm,
    escolherModeloDeepSeek: setModeloDeepSeek,
    /** Campos `llm` e `modelo` do pedido. No Gemini vai só a IA: vale o modelo padrão do agente. */
    get pedido(): { llm: LlmProvider; modelo?: string } {
      return llm === "deepseek" ? { llm, modelo: modeloDeepSeek } : { llm };
    },
  };
}

export type EscolhaIa = ReturnType<typeof useEscolhaIa>;

export function EscolhaDaIa({ escolha, pending }: { escolha: EscolhaIa; pending: boolean }) {
  const { provedores, llm, modeloDeepSeek } = escolha;

  return (
    <div className="space-y-3">
      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">IA que gera</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          <Opcao
            nome="ia"
            marcada={llm === "deepseek"}
            desabilitada={pending || !provedores.deepseek.configurado}
            onEscolher={() => escolha.escolherIa("deepseek")}
            titulo="DeepSeek"
            selo={<Badge variant="success">Recomendado</Badge>}
            descricao={
              provedores.deepseek.configurado ? "Você escolhe o modelo" : "Sem chave: defina DEEPSEEK_API_KEY no .env."
            }
          />
          <Opcao
            nome="ia"
            marcada={llm === "gemini"}
            desabilitada={pending || !provedores.gemini.configurado}
            onEscolher={() => escolha.escolherIa("gemini")}
            titulo="Gemini"
            descricao={
              provedores.gemini.configurado
                ? `${provedores.gemini.modeloPadrao} · cerca de 5 s`
                : "Sem chave: defina GEMINI_API_KEY no .env."
            }
          />
        </div>
      </fieldset>

      {llm === "deepseek" ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-bold">Modelo do DeepSeek</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {MODELOS_DEEPSEEK.map((modelo) => (
              <Opcao
                key={modelo.valor}
                nome="modelo-deepseek"
                marcada={modeloDeepSeek === modelo.valor}
                desabilitada={pending}
                onEscolher={() => escolha.escolherModeloDeepSeek(modelo.valor)}
                titulo={modelo.nome}
                selo={modelo.recomendado ? <Badge variant="success">Recomendado</Badge> : null}
                descricao={modelo.descricao}
              />
            ))}
          </div>
        </fieldset>
      ) : null}
    </div>
  );
}

interface OpcaoProps {
  nome: string;
  marcada: boolean;
  desabilitada: boolean;
  onEscolher: () => void;
  titulo: string;
  descricao: string;
  selo?: ReactNode;
}

function Opcao({ nome, marcada, desabilitada, onEscolher, titulo, descricao, selo }: OpcaoProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer gap-2.5 rounded-xl border px-3 py-2.5 transition-colors",
        "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
        marcada ? "border-primary bg-primary-soft/50" : "border-border bg-card hover:border-primary/50 hover:bg-accent",
        desabilitada && "cursor-not-allowed hover:border-border hover:bg-card",
        desabilitada && !marcada && "opacity-60",
      )}
    >
      <input
        type="radio"
        name={nome}
        className="sr-only"
        checked={marcada}
        disabled={desabilitada}
        onChange={onEscolher}
      />
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
          marcada ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
        )}
      >
        {marcada ? <Check className="size-3.5" /> : null}
      </span>
      <span className="min-w-0 space-y-0.5">
        <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
          {titulo}
          {selo}
        </span>
        <span className="block text-xs leading-snug text-muted-foreground">{descricao}</span>
      </span>
    </label>
  );
}
