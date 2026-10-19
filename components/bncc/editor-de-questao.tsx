"use client";

// Editor de uma questão da prova (nova ou gerada pela IA): tipo, enunciado, alternativas, resposta,
// critérios e o código BNCC, com a busca da habilidade que encaixa no texto escrito.
import { BookOpenCheck, Check, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { ActionResult } from "@/lib/action-result";
import type { SugestaoDeHabilidades } from "@/lib/bncc/agent-service";
import type { HabilidadeConsultada } from "@/lib/bncc/plano";
import { LETRAS, problemaDaQuestao, type QuestaoProva } from "@/lib/bncc/prova";
import { cn } from "@/lib/utils";

const LIMITE = { enunciado: 1_500, alternativa: 300, resposta: 800, criterios: 800 } as const;

/** Texto enviado à busca: o enunciado e as alternativas ajudam a achar a habilidade. */
function textoParaBusca(questao: QuestaoProva): string {
  const alternativas = questao.tipo === "multipla_escolha" ? questao.alternativas.map((a) => a.texto.trim()).filter(Boolean) : [];
  return [questao.enunciado.trim(), ...alternativas].join("\n");
}

interface EditorDeQuestaoProps {
  inicial: QuestaoProva;
  /** Habilidade atual da questão (texto oficial), se tiver código. */
  habilidadeInicial: HabilidadeConsultada | null;
  numero: number;
  /** Rota da busca de habilidades; sem ela, o botão "Procurar código BNCC" não aparece. */
  endpointBusca?: string;
  /** Filtros da busca: a disciplina da prova e o ano da turma (com os anteriores). */
  componente: string | null;
  anoMaximo: string | null;
  onSalvar: (questao: QuestaoProva, habilidade: HabilidadeConsultada | null) => void;
  onCancelar: () => void;
}

type EstadoDaBusca =
  | { etapa: "parada" }
  | { etapa: "buscando" }
  | { etapa: "pronta"; sugestao: SugestaoDeHabilidades }
  | { etapa: "erro"; mensagem: string };

export function EditorDeQuestao({
  inicial,
  habilidadeInicial,
  numero,
  endpointBusca,
  componente,
  anoMaximo,
  onSalvar,
  onCancelar,
}: EditorDeQuestaoProps) {
  const [questao, setQuestao] = useState<QuestaoProva>(inicial);
  const [habilidade, setHabilidade] = useState<HabilidadeConsultada | null>(habilidadeInicial);
  const [problema, setProblema] = useState<string | null>(null);
  const [busca, setBusca] = useState<EstadoDaBusca>({ etapa: "parada" });
  const buscaRef = useRef<AbortController | null>(null);

  useEffect(() => () => buscaRef.current?.abort(), []);

  function mudar(campos: Partial<QuestaoProva>) {
    setQuestao((atual) => ({ ...atual, ...campos }));
    setProblema(null);
  }

  function mudarTipo(tipo: QuestaoProva["tipo"]) {
    mudar(
      tipo === "multipla_escolha"
        ? { tipo, alternativas: LETRAS.map((letra) => ({ letra, texto: "" })), resposta: "" }
        : { tipo, alternativas: [], resposta: "" },
    );
  }

  function mudarAlternativa(letra: string, texto: string) {
    setQuestao((atual) => ({
      ...atual,
      alternativas: atual.alternativas.map((alternativa) => (alternativa.letra === letra ? { ...alternativa, texto } : alternativa)),
    }));
    setProblema(null);
  }

  function usarHabilidade(nova: HabilidadeConsultada | null) {
    setHabilidade(nova);
    // O tópico escrito pela IA era do código anterior.
    setQuestao((atual) => ({ ...atual, habilidade: nova?.codigo ?? "", topico: nova?.codigo === inicial.habilidade ? inicial.topico : "" }));
  }

  async function procurar() {
    if (!endpointBusca) return;
    buscaRef.current?.abort();
    const controller = new AbortController();
    buscaRef.current = controller;
    setBusca({ etapa: "buscando" });
    try {
      const response = await fetch(endpointBusca, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: textoParaBusca(questao), componente: componente ?? undefined, anoMaximo: anoMaximo ?? undefined }),
        signal: controller.signal,
      });
      const resultado = (await response.json()) as ActionResult<SugestaoDeHabilidades>;
      if (!resultado.ok || !resultado.data) {
        setBusca({
          etapa: "erro",
          mensagem: resultado.ok ? "A busca voltou vazia." : (resultado.fieldErrors?.texto?.[0] ?? resultado.error),
        });
        return;
      }
      setBusca({ etapa: "pronta", sugestao: resultado.data });
      // Encaixou: o código já entra na questão (o professor pode trocar ou tirar).
      if (resultado.data.encaixa) usarHabilidade(resultado.data.habilidades[0]!);
    } catch {
      if (!controller.signal.aborted) setBusca({ etapa: "erro", mensagem: "Sem conexão com o servidor. Tente de novo." });
    }
  }

  function salvar() {
    const limpa: QuestaoProva = {
      ...questao,
      enunciado: questao.enunciado.trim(),
      alternativas: questao.alternativas.map((alternativa) => ({ ...alternativa, texto: alternativa.texto.trim() })),
      resposta: questao.resposta.trim(),
      criterios: questao.criterios.trim(),
    };
    const falta = problemaDaQuestao(limpa);
    if (falta) {
      setProblema(falta);
      return;
    }
    onSalvar(limpa, habilidade);
  }

  const id = (campo: string) => `questao-${numero}-${campo}`;
  const curtoDemais = questao.enunciado.trim().length < 10;

  return (
    <li className="space-y-3 rounded-xl border-2 border-primary/50 bg-primary-soft/20 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold">{inicial.enunciado ? `Editando a questão ${numero}` : `Nova questão (${numero})`}</p>
        <Select
          aria-label="Tipo da questão"
          value={questao.tipo}
          onChange={(event) => mudarTipo(event.target.value as QuestaoProva["tipo"])}
          className="h-9 w-auto"
        >
          <option value="multipla_escolha">Múltipla escolha</option>
          <option value="discursiva">Discursiva</option>
        </Select>
      </div>

      <Field label="Enunciado" htmlFor={id("enunciado")}>
        <Textarea
          id={id("enunciado")}
          value={questao.enunciado}
          onChange={(event) => mudar({ enunciado: event.target.value })}
          maxLength={LIMITE.enunciado}
          rows={3}
          placeholder="Ex.: Ana tem 3 caixas com 4 lápis em cada uma. Quantos lápis ela tem ao todo?"
        />
      </Field>

      {questao.tipo === "multipla_escolha" ? (
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold">Alternativas · marque a correta</legend>
          {questao.alternativas.map((alternativa) => {
            const correta = questao.resposta === alternativa.letra;
            return (
              <div key={alternativa.letra} className="flex items-center gap-2">
                <label
                  className={cn(
                    "flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border text-sm font-bold",
                    "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                    correta ? "border-success bg-success-soft text-success" : "border-input bg-card hover:bg-accent",
                  )}
                  title={`Marcar a alternativa ${alternativa.letra} como correta`}
                >
                  <input
                    type="radio"
                    name={id("correta")}
                    className="sr-only"
                    checked={correta}
                    onChange={() => mudar({ resposta: alternativa.letra })}
                    aria-label={`Alternativa ${alternativa.letra} é a correta`}
                  />
                  {correta ? <Check className="size-4" aria-hidden /> : alternativa.letra}
                </label>
                <Input
                  aria-label={`Alternativa ${alternativa.letra}`}
                  value={alternativa.texto}
                  onChange={(event) => mudarAlternativa(alternativa.letra, event.target.value)}
                  maxLength={LIMITE.alternativa}
                  placeholder={`Alternativa ${alternativa.letra}`}
                  className="h-9"
                />
              </div>
            );
          })}
        </fieldset>
      ) : (
        <Field label="Resposta esperada" htmlFor={id("resposta")} hint="Vai só no gabarito do professor.">
          <Textarea
            id={id("resposta")}
            value={questao.resposta}
            onChange={(event) => mudar({ resposta: event.target.value })}
            maxLength={LIMITE.resposta}
            rows={2}
          />
        </Field>
      )}

      <Field label="Critérios de correção (opcional)" htmlFor={id("criterios")}>
        <Textarea
          id={id("criterios")}
          value={questao.criterios}
          onChange={(event) => mudar({ criterios: event.target.value })}
          maxLength={LIMITE.criterios}
          rows={2}
          className="min-h-14"
        />
      </Field>

      <div className="space-y-2 rounded-lg border border-border bg-card p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold">Habilidade da BNCC</p>
          {endpointBusca ? (
            <Button
              variant="soft"
              size="sm"
              onClick={() => void procurar()}
              loading={busca.etapa === "buscando"}
              disabled={curtoDemais}
              title={curtoDemais ? "Escreva o enunciado antes de procurar." : undefined}
            >
              {busca.etapa === "buscando" ? null : <Search className="size-4" aria-hidden />}
              Procurar código BNCC
            </Button>
          ) : null}
        </div>

        {habilidade ? (
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 text-sm">
              <Badge className="font-mono tracking-wide">
                <BookOpenCheck aria-hidden />
                {habilidade.codigo}
              </Badge>
              <span className="ml-1.5 text-xs text-muted-foreground">
                {habilidade.componente} · {habilidade.anoFaixa}
              </span>
              <p className="mt-1 leading-snug text-foreground/85">{habilidade.descricao}</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => usarHabilidade(null)} aria-label="Tirar o código BNCC">
              <X className="size-4" aria-hidden />
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Sem código BNCC.{endpointBusca ? " Escreva a questão e clique em “Procurar código BNCC”." : ""}
          </p>
        )}

        {busca.etapa === "erro" ? <p className="text-sm text-destructive">{busca.mensagem}</p> : null}
        {busca.etapa === "pronta" ? (
          <ResultadoDaBusca sugestao={busca.sugestao} atual={habilidade?.codigo ?? ""} onEscolher={usarHabilidade} />
        ) : null}
      </div>

      {problema ? <Alert variant="error">{problema}</Alert> : null}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="outline" size="sm" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button size="sm" onClick={salvar}>
          <Check className="size-4" aria-hidden />
          Salvar questão
        </Button>
      </div>
    </li>
  );
}

function ResultadoDaBusca({
  sugestao,
  atual,
  onEscolher,
}: {
  sugestao: SugestaoDeHabilidades;
  atual: string;
  onEscolher: (habilidade: HabilidadeConsultada) => void;
}) {
  const { habilidades, encaixa } = sugestao;
  if (habilidades.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhuma habilidade encontrada. A questão pode ficar sem código.</p>;
  }
  const outras = habilidades.filter((h) => h.codigo !== atual);

  return (
    <div className="space-y-2 border-t border-border pt-2">
      <p className={cn("text-sm", encaixa ? "text-success" : "text-muted-foreground")}>
        {encaixa
          ? `Encaixou: ${habilidades[0]!.codigo}. Já coloquei na questão.`
          : "Nenhuma habilidade da BNCC encaixou bem. Tudo bem: a questão pode ficar sem código."}
      </p>
      {outras.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground">
            {encaixa ? "Outras parecidas:" : "As mais próximas, se quiser usar uma:"}
          </p>
          <ul className="space-y-1.5">
            {outras.map((habilidade) => (
              <li key={habilidade.codigo}>
                <button
                  type="button"
                  onClick={() => onEscolher(habilidade)}
                  className="w-full rounded-lg border border-border px-2.5 py-1.5 text-left text-xs transition-colors hover:border-primary/50 hover:bg-accent"
                >
                  <span className="font-mono font-semibold">{habilidade.codigo}</span>{" "}
                  <span className="text-muted-foreground">
                    ({habilidade.anoFaixa}) · usar este
                  </span>
                  <span className="mt-0.5 block leading-snug text-foreground/85">{habilidade.descricao}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
