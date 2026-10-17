"use client";

import { LoaderCircle, Sparkles } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea, fieldA11y } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/page-elements";
import { useGerarPlano } from "@/hooks/use-gerar-plano";
import { ANOS_ESCOLARES, GRUPOS_DE_COMPONENTES } from "@/lib/bncc/codigos";
import { LIMITS } from "@/lib/limits";
import { PlanView } from "./plan-view";

/** Formulário do planejador + resultado. Usado pela página de demonstração. */
export function Planner({ endpoint }: { endpoint: string }) {
  const [tema, setTema] = useState("");
  const [componente, setComponente] = useState("");
  const [anoEscolar, setAnoEscolar] = useState("");
  const { plano, pending, error, fieldErrors, gerar, cancelar } = useGerarPlano(endpoint);
  const temaError = fieldErrors?.tema?.[0];

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending) void gerar({ tema, componente, anoEscolar });
  }

  return (
    <div className="space-y-5">
      <form onSubmit={handleSubmit} className="space-y-3" noValidate>
        <Field label="O que você deseja trabalhar na aula?" htmlFor="bncc-tema" error={temaError}>
          <Textarea
            id="bncc-tema"
            value={tema}
            onChange={(event) => setTema(event.target.value)}
            maxLength={LIMITS.tema}
            rows={3}
            placeholder="Ex.: frações equivalentes usando receitas de bolo"
            disabled={pending}
            autoFocus
            {...fieldA11y("bncc-tema", temaError)}
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Disciplina (opcional)" htmlFor="bncc-componente" error={fieldErrors?.componente?.[0]}>
            <Select
              id="bncc-componente"
              value={componente}
              onChange={(event) => setComponente(event.target.value)}
              disabled={pending}
            >
              <option value="">Todas as disciplinas</option>
              {GRUPOS_DE_COMPONENTES.map((grupo) => (
                <optgroup key={grupo.etapa} label={grupo.etapa}>
                  {grupo.componentes.map((nome) => (
                    <option key={nome} value={nome}>
                      {nome}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </Field>
          <Field label="Ano escolar (opcional)" htmlFor="bncc-ano" error={fieldErrors?.anoEscolar?.[0]}>
            <Select
              id="bncc-ano"
              value={anoEscolar}
              onChange={(event) => setAnoEscolar(event.target.value)}
              disabled={pending}
            >
              <option value="">Todos os anos</option>
              {ANOS_ESCOLARES.map((opcao) => (
                <option key={opcao.value} value={opcao.value}>
                  {opcao.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {error && !fieldErrors ? <Alert variant="error">{error}</Alert> : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          {pending ? (
            <Button variant="outline" onClick={cancelar}>
              Cancelar
            </Button>
          ) : null}
          <Button type="submit" loading={pending} disabled={tema.trim().length < 3}>
            {pending ? null : <Sparkles className="size-4" aria-hidden />}
            {plano ? "Gerar outro plano" : "Gerar plano"}
          </Button>
        </div>
      </form>

      {pending ? <PlanLoading /> : plano ? <PlanView plano={plano} /> : null}
    </div>
  );
}

const ETAPAS_DO_CARREGAMENTO = [
  { ateMs: 3_000, texto: "Buscando as habilidades mais próximas na BNCC…" },
  { ateMs: 25_000, texto: "Escrevendo o plano com base nas habilidades oficiais…" },
  { ateMs: Number.POSITIVE_INFINITY, texto: "Quase lá: conferindo os códigos e finalizando o plano…" },
];

function PlanLoading() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 500);
    return () => window.clearInterval(timer);
  }, []);

  const etapa = ETAPAS_DO_CARREGAMENTO.find((item) => elapsed < item.ateMs) ?? ETAPAS_DO_CARREGAMENTO[0]!;

  return (
    <div role="status" aria-live="polite" className="space-y-4 border-t border-border pt-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-primary">
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
        {etapa.texto}
      </p>
      <div className="space-y-2">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}
