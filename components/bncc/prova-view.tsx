"use client";

import { BookOpenCheck, Check, Copy, Eye, EyeOff, ListChecks, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { AVISO_IA_PROVA, type ProvaGerada, type QuestaoProva } from "@/lib/bncc/prova";
import { cn } from "@/lib/utils";

/** Prova gerada, com o gabarito escondido até o professor pedir. */
export function ProvaView({ prova }: { prova: ProvaGerada }) {
  const [comGabarito, setComGabarito] = useState(false);
  const identificacao = [
    { rotulo: "Componente curricular", valor: prova.identificacao.componente },
    { rotulo: "Ano", valor: prova.identificacao.ano },
    { rotulo: "Bimestre", valor: prova.identificacao.bimestre },
  ].filter((item) => item.valor);
  const objetivas = prova.questoes.filter((q) => q.tipo === "multipla_escolha").length;

  return (
    <article className="space-y-5" aria-label="Prova gerada">
      <header className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {prova.habilidades.map((habilidade) => (
            <CodigoBadge key={habilidade.codigo} codigo={habilidade.codigo} />
          ))}
        </div>
        <h3 className="text-lg font-extrabold leading-tight">{prova.titulo}</h3>
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
        <p className="text-sm text-muted-foreground">
          {prova.questoes.length} questões · {objetivas} de múltipla escolha · {prova.questoes.length - objetivas} discursivas
        </p>
        {prova.complemento ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Orientações do professor: </span>
            {prova.complemento}
          </p>
        ) : null}
      </header>

      {prova.aviso ? (
        <Alert variant="warning" title="Atenção">
          {prova.aviso}
        </Alert>
      ) : null}

      {prova.instrucoes.length > 0 ? (
        <Section icon={ListChecks} title="Instruções">
          <ul className="list-disc space-y-1 pl-5 text-sm marker:text-primary">
            {prova.instrucoes.map((instrucao) => (
              <li key={instrucao}>{instrucao}</li>
            ))}
          </ul>
        </Section>
      ) : null}

      <div className="flex justify-end">
        <Button variant="soft" size="sm" onClick={() => setComGabarito((atual) => !atual)} aria-pressed={comGabarito}>
          {comGabarito ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
          {comGabarito ? "Ocultar gabarito" : "Mostrar gabarito"}
        </Button>
      </div>

      <ol className="space-y-4">
        {prova.questoes.map((questao) => (
          <Questao key={questao.numero} questao={questao} comGabarito={comGabarito} />
        ))}
      </ol>

      <details className="rounded-xl border border-border px-3 py-2 text-sm">
        <summary className="font-semibold text-muted-foreground">Habilidades avaliadas ({prova.habilidades.length})</summary>
        <ul className="mt-2 space-y-2 pb-1">
          {prova.habilidades.map((habilidade) => (
            <li key={habilidade.codigo}>
              <span className="font-mono text-xs font-semibold">{habilidade.codigo}</span>{" "}
              <span className="text-xs text-muted-foreground">
                ({habilidade.componente} · {habilidade.anoFaixa} ·{" "}
                {prova.questoes.filter((q) => q.habilidade === habilidade.codigo).length} questões)
              </span>
              <p className="text-foreground/80">{habilidade.descricao}</p>
            </li>
          ))}
        </ul>
      </details>

      <p className="text-xs text-muted-foreground">{AVISO_IA_PROVA}</p>

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
        <BotaoCopiar texto={prova.textoGabarito} rotulo="Copiar gabarito" variant="outline" />
        <BotaoCopiar texto={prova.textoProva} rotulo="Copiar prova (sem gabarito)" />
      </div>
    </article>
  );
}

function Questao({ questao, comGabarito }: { questao: QuestaoProva; comGabarito: boolean }) {
  return (
    <li className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
          {questao.numero}
        </span>
        <CodigoBadge codigo={questao.habilidade} />
        <span className="text-xs font-semibold text-muted-foreground">
          {questao.tipo === "multipla_escolha" ? "Múltipla escolha" : "Discursiva"}
        </span>
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed">{questao.enunciado}</p>

      {questao.tipo === "multipla_escolha" ? (
        <ul className="space-y-1">
          {questao.alternativas.map((alternativa) => {
            const correta = comGabarito && alternativa.letra === questao.resposta;
            return (
              <li
                key={alternativa.letra}
                className={cn("flex gap-2 rounded-lg px-2 py-1 text-sm", correta && "bg-success-soft font-semibold text-success")}
              >
                <span className="font-semibold">({alternativa.letra})</span>
                <span className="min-w-0">{alternativa.texto}</span>
                {correta ? <Check className="ml-auto size-4 shrink-0" aria-label="Alternativa correta" /> : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {comGabarito ? (
        <div className="space-y-1 rounded-lg bg-muted/50 px-3 py-2 text-sm">
          {questao.tipo === "discursiva" ? (
            <p>
              <span className="font-semibold">Resposta esperada: </span>
              {questao.resposta}
            </p>
          ) : null}
          {questao.criterios ? (
            <p className="text-foreground/85">
              <span className="font-semibold">Critérios: </span>
              {questao.criterios}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function BotaoCopiar({ texto, rotulo, variant = "primary" }: { texto: string; rotulo: string; variant?: "primary" | "outline" }) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <Button variant={variant} onClick={() => copy(texto)}>
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? "Copiado!" : rotulo}
    </Button>
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
