"use client";

import {
  BookOpenCheck,
  Check,
  ClipboardCheck,
  Clock,
  Copy,
  FileDown,
  ListOrdered,
  SendHorizontal,
  Target,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBaixarPdf } from "@/hooks/use-baixar-pdf";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { AVISO_IA, type PlanoGerado } from "@/lib/bncc/plano";
import { nomeDeArquivo } from "@/lib/pdf/quebra";

interface PlanViewProps {
  plano: PlanoGerado;
  /** Ação extra do sistema cliente (ex.: "Publicar no feed"). */
  onPublicar?: () => void;
  publicarLabel?: string;
}

/** Plano de aula gerado, com os códigos oficiais da BNCC em destaque. */
export function PlanView({ plano, onPublicar, publicarLabel = "Publicar" }: PlanViewProps) {
  const { copied, copy } = useCopyToClipboard();
  const { gerando, erro: erroDoPdf, baixar } = useBaixarPdf();
  const escolhida = plano.origem === "habilidade_escolhida";
  const identificacao = [
    { rotulo: "Componente curricular", valor: plano.identificacao.componente },
    { rotulo: "Ano", valor: plano.identificacao.ano },
    { rotulo: "Bimestre", valor: plano.identificacao.bimestre },
  ].filter((item) => item.valor);

  return (
    <article className="space-y-5" aria-label="Plano de aula gerado">
      <header className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {plano.habilidades.map((habilidade) => (
            <CodigoBadge key={habilidade.codigo} codigo={habilidade.codigo} />
          ))}
        </div>
        <h3 className="text-lg font-extrabold leading-tight">{plano.titulo}</h3>
        {identificacao.length > 0 ? (
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {identificacao.map((item) => (
              <div key={item.rotulo} className="flex gap-1">
                <dt className="text-muted-foreground">{item.rotulo}:</dt>
                <dd className="font-semibold">{item.valor}</dd>
              </div>
            ))}
          </dl>
        ) : null}
        {plano.complemento ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Orientações do professor: </span>
            {plano.complemento}
          </p>
        ) : null}
        {plano.duracao ? (
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="size-4" aria-hidden />
            {plano.duracao}
          </p>
        ) : null}
      </header>

      {plano.aviso ? (
        <Alert variant="warning" title="Atenção ao alinhamento">
          {plano.aviso}
        </Alert>
      ) : null}

      <Section icon={BookOpenCheck} title={plano.habilidades.length === 1 ? "Habilidade da BNCC" : "Habilidades da BNCC"}>
        <ul className="space-y-3">
          {plano.habilidades.map((habilidade) => (
            <li key={habilidade.codigo} className="rounded-xl border border-border bg-muted/40 p-3">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <CodigoBadge codigo={habilidade.codigo} />
                <span className="text-xs font-semibold text-muted-foreground">
                  {habilidade.componente} · {habilidade.anoFaixa}
                </span>
              </div>
              <blockquote className="mt-2 border-l-2 border-primary/40 pl-3 text-sm italic text-foreground/85">
                {habilidade.descricao}
              </blockquote>
              {habilidade.justificativa ? (
                <p className="mt-2 text-sm">
                  <span className="font-semibold">{escolhida ? "Como a aula desenvolve: " : "Por que: "}</span>
                  {habilidade.justificativa}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={Target} title="Objetivos de aprendizagem">
        <ul className="list-disc space-y-1 pl-5 text-sm marker:text-primary">
          {plano.objetivos.map((objetivo) => (
            <li key={objetivo}>{objetivo}</li>
          ))}
        </ul>
      </Section>

      <Section icon={ListOrdered} title="Metodologia">
        <ol className="space-y-3">
          {plano.metodologia.map((etapa, index) => (
            <li key={`${index}-${etapa.titulo}`} className="flex gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
                {index + 1}
              </span>
              <div className="min-w-0 text-sm">
                <p className="font-semibold">
                  {etapa.titulo}
                  {etapa.duracao ? (
                    <span className="ml-1.5 font-normal text-muted-foreground">· {etapa.duracao}</span>
                  ) : null}
                </p>
                <p className="text-foreground/85">{etapa.descricao}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section icon={ClipboardCheck} title="Avaliação formativa">
        <ul className="space-y-2 text-sm">
          {plano.avaliacao.map((item) => (
            <li key={item.instrumento}>
              <span className="font-semibold">{item.instrumento}: </span>
              {item.descricao}
            </li>
          ))}
        </ul>
      </Section>

      {escolhida ? null : (
        <details className="rounded-xl border border-border px-3 py-2 text-sm">
          <summary className="font-semibold text-muted-foreground">
            Habilidades consultadas na BNCC ({plano.consultadas.length})
          </summary>
          <ul className="mt-2 space-y-2 pb-1">
            {plano.consultadas.map((habilidade) => (
              <li key={habilidade.codigo}>
                <span className="font-mono text-xs font-semibold">{habilidade.codigo}</span>{" "}
                <span className="text-xs text-muted-foreground">
                  ({habilidade.componente} · {habilidade.anoFaixa} · {Math.round(habilidade.similaridade * 100)}% de
                  afinidade)
                </span>
                <p className="text-foreground/80">{habilidade.descricao}</p>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-xs text-muted-foreground">{AVISO_IA}</p>

      {erroDoPdf ? <Alert variant="error">{erroDoPdf}</Alert> : null}
      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <Button variant="outline" onClick={() => copy(plano.texto)}>
          {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
          {copied ? "Copiado!" : "Copiar plano"}
        </Button>
        <Button
          variant={onPublicar ? "outline" : "primary"}
          loading={gerando !== null}
          onClick={() =>
            void baixar(
              "plano",
              async () => (await import("@/lib/pdf/plano-pdf")).gerarPdfDoPlano(plano),
              nomeDeArquivo("plano-de-aula", plano.titulo),
            )
          }
        >
          {gerando ? null : <FileDown className="size-4" aria-hidden />}
          Baixar PDF
        </Button>
        {onPublicar ? (
          <Button onClick={onPublicar}>
            <SendHorizontal className="size-4" aria-hidden />
            {publicarLabel}
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function CodigoBadge({ codigo }: { codigo: string }) {
  return (
    <Badge className="font-mono tracking-wide" title="Código oficial da BNCC">
      <BookOpenCheck aria-hidden />
      {codigo}
    </Badge>
  );
}

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4 text-primary" aria-hidden />
        {title}
      </h4>
      {children}
    </section>
  );
}
