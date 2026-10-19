"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useGerarPlano } from "@/hooks/use-gerar-plano";
import type { DisciplinaComHabilidades } from "@/lib/bncc/calendario";
import { EscolhaDaIa, useEscolhaIa, type ProvedoresDaIa } from "./escolha-ia";
import { PlanView } from "./plan-view";
import {
  CampoComplemento,
  CarregandoGeracao,
  FiltrosBncc,
  HabilidadesMarcadas,
  ListaDeHabilidades,
  useSelecaoBncc,
} from "./selecao-bncc";

interface PlannerProps {
  endpoint: string;
  /** Disciplina → ano → bimestre → habilidades (prisma/data/bncc-bimestres.json + texto oficial). */
  disciplinas: DisciplinaComHabilidades[];
  /** Quais IAs têm chave e o modelo padrão de cada uma. */
  provedores: ProvedoresDaIa;
}

const ETAPAS_DO_CARREGAMENTO = [
  { ateMs: 3_000, texto: "Lendo as habilidades escolhidas na BNCC…" },
  { ateMs: 25_000, texto: "Escrevendo objetivos, metodologia e avaliação a partir das habilidades…" },
  { ateMs: Number.POSITIVE_INFINITY, texto: "Quase lá: conferindo os códigos e finalizando o plano…" },
];

/**
 * Planejador guiado: o professor escolhe disciplina, ano e bimestre, marca uma ou mais habilidades
 * e, se quiser, complementa com orientações. O plano sai preenchido a partir delas, sem precisar
 * digitar o tema. Usado pela página de demonstração.
 */
export function Planner({ endpoint, disciplinas, provedores }: PlannerProps) {
  const selecao = useSelecaoBncc(disciplinas);
  const escolhaIa = useEscolhaIa(provedores);
  const [complemento, setComplemento] = useState("");
  const { plano, pending, error, fieldErrors, gerar, cancelar } = useGerarPlano(endpoint);
  const resultadoRef = useRef<HTMLDivElement>(null);
  const { pedido } = selecao;

  useEffect(() => {
    if (pending) resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [pending]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !pedido) return;
    void gerar({ ...pedido, ...escolhaIa.pedido, complemento });
  }

  return (
    <div className="space-y-5">
      <FiltrosBncc selecao={selecao} pending={pending} />
      <HabilidadesMarcadas selecao={selecao} pending={pending} />
      <ListaDeHabilidades selecao={selecao} pending={pending} finalidade="para o plano de aula" />

      {selecao.mostrarFormulario ? (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <CampoComplemento
            label="Complemento para o plano (opcional)"
            placeholder="Ex.: turma de 28 alunos, aula de 50 minutos, usar material reciclável, incluir adaptação para estudante com TEA."
            value={complemento}
            onChange={setComplemento}
            pending={pending}
            error={fieldErrors?.complemento?.[0]}
          />

          <EscolhaDaIa escolha={escolhaIa} pending={pending} />

          {error ? <Alert variant="error">{error}</Alert> : null}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            {pending ? (
              <Button variant="outline" onClick={cancelar}>
                Cancelar
              </Button>
            ) : null}
            <Button type="submit" loading={pending} disabled={!pedido}>
              {pending ? null : <Sparkles className="size-4" aria-hidden />}
              {!pedido
                ? "Escolha ao menos uma habilidade"
                : `Gerar plano com ${pedido.habilidades.length} ${pedido.habilidades.length === 1 ? "habilidade" : "habilidades"}`}
            </Button>
          </div>
        </form>
      ) : null}

      <div ref={resultadoRef} className="scroll-mt-4">
        {pending ? (
          <CarregandoGeracao etapas={ETAPAS_DO_CARREGAMENTO} />
        ) : plano ? (
          <div className="border-t border-border pt-5">
            <PlanView plano={plano} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
