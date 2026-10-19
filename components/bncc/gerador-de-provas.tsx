"use client";

import { FileCheck2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Select } from "@/components/ui/input";
import { useGerarProva } from "@/hooks/use-gerar-plano";
import type { DisciplinaComHabilidades } from "@/lib/bncc/calendario";
import { anoMaisAlto } from "@/lib/bncc/escopo";
import { FORMATOS_PROVA, QUESTOES, ROTULOS_FORMATO, type FormatoProva } from "@/lib/bncc/prova";
import { EscolhaDaIa, useEscolhaIa, type ProvedoresDaIa } from "./escolha-ia";
import { ProvaView } from "./prova-view";
import {
  CampoComplemento,
  CarregandoGeracao,
  FiltrosBncc,
  HabilidadesMarcadas,
  ListaDeHabilidades,
  useSelecaoBncc,
} from "./selecao-bncc";

const OPCOES_DE_QUANTIDADE = [5, 8, 10, 12, 15, 20].filter((n) => n >= QUESTOES.minimo && n <= QUESTOES.maximo);

const ETAPAS_DO_CARREGAMENTO = [
  { ateMs: 3_000, texto: "Lendo as habilidades escolhidas na BNCC…" },
  { ateMs: 30_000, texto: "Escrevendo as questões, as alternativas e o gabarito…" },
  { ateMs: Number.POSITIVE_INFINITY, texto: "Quase lá: conferindo as questões e o gabarito…" },
];

/**
 * Gerador de provas guiado, no mesmo fluxo do planejador: disciplina, ano e bimestre, habilidades
 * marcadas, número de questões, formato e um complemento opcional.
 */
interface GeradorDeProvasProps {
  endpoint: string;
  disciplinas: DisciplinaComHabilidades[];
  provedores: ProvedoresDaIa;
}

export function GeradorDeProvas({ endpoint, disciplinas, provedores }: GeradorDeProvasProps) {
  const selecao = useSelecaoBncc(disciplinas);
  const escolhaIa = useEscolhaIa(provedores);
  const [quantidade, setQuantidade] = useState<number>(QUESTOES.padrao);
  const [formato, setFormato] = useState<FormatoProva>("mista");
  const [complemento, setComplemento] = useState("");
  // Ano sugerido para o cabeçalho, guardado no pedido: o maior entre as marcadas (turma que retoma anos anteriores).
  const [anoSugerido, setAnoSugerido] = useState<string | null>(null);
  const { prova, pending, error, fieldErrors, gerar, cancelar } = useGerarProva(endpoint);
  const resultadoRef = useRef<HTMLDivElement>(null);
  const { pedido } = selecao;

  useEffect(() => {
    if (pending) resultadoRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [pending]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || !pedido) return;
    setAnoSugerido(anoMaisAlto(selecao.selecionadas));
    void gerar({ ...pedido, ...escolhaIa.pedido, complemento, quantidade, formato });
  }

  return (
    <div className="space-y-5">
      <FiltrosBncc selecao={selecao} pending={pending} />
      <HabilidadesMarcadas selecao={selecao} pending={pending} />
      <ListaDeHabilidades selecao={selecao} pending={pending} finalidade="para a prova" />

      {selecao.mostrarFormulario ? (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Número de questões" htmlFor="prova-quantidade" error={fieldErrors?.quantidade?.[0]}>
              <Select
                id="prova-quantidade"
                value={quantidade}
                onChange={(event) => setQuantidade(Number(event.target.value))}
                disabled={pending}
              >
                {OPCOES_DE_QUANTIDADE.map((n) => (
                  <option key={n} value={n}>
                    {n} questões
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Formato" htmlFor="prova-formato" error={fieldErrors?.formato?.[0]}>
              <Select
                id="prova-formato"
                value={formato}
                onChange={(event) => setFormato(event.target.value as FormatoProva)}
                disabled={pending}
              >
                {FORMATOS_PROVA.map((item) => (
                  <option key={item} value={item}>
                    {ROTULOS_FORMATO[item]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <CampoComplemento
            label="Complemento para a prova (opcional)"
            placeholder="Ex.: questões curtas, usar situações de compra e venda, incluir uma questão com tabela, prova adaptada para estudante com dislexia."
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
              {pending ? null : <FileCheck2 className="size-4" aria-hidden />}
              {!pedido ? "Escolha ao menos uma habilidade" : `Gerar prova com ${quantidade} questões`}
            </Button>
          </div>
        </form>
      ) : null}

      <div ref={resultadoRef} className="scroll-mt-4">
        {pending ? (
          <CarregandoGeracao etapas={ETAPAS_DO_CARREGAMENTO} />
        ) : prova ? (
          <div className="border-t border-border pt-5">
            <ProvaView prova={prova} anoSugerido={anoSugerido} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
