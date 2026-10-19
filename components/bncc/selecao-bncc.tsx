"use client";

// Peças comuns ao planejador de aulas e ao gerador de provas: os menus disciplina → ano → bimestre,
// a lista de habilidades com seleção múltipla, o campo de complemento e o indicador de carregamento.
import { BookOpenCheck, Check, History, LoaderCircle, MousePointerClick, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Field, Select, Textarea, fieldA11y } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/page-elements";
import type { DisciplinaComHabilidades, HabilidadeDaLista } from "@/lib/bncc/calendario";
import { escopoDoPedido, type HabilidadeMarcada } from "@/lib/bncc/escopo";
import { LIMITS } from "@/lib/limits";
import { cn } from "@/lib/utils";

/**
 * Estado dos menus e das habilidades marcadas. Trocar o ano ou o bimestre não desmarca nada: o
 * professor pode juntar habilidades de períodos diferentes (até o limite). Trocar a disciplina limpa
 * a seleção, porque o plano e a prova são de uma disciplina só.
 */
export function useSelecaoBncc(disciplinas: DisciplinaComHabilidades[]) {
  const [nomeDisciplina, setNomeDisciplina] = useState(() => disciplinas.find((d) => d.disponivel)?.nome ?? "");
  const [anoEscolar, setAnoEscolar] = useState("");
  const [bimestre, setBimestre] = useState("");
  const [selecionadas, setSelecionadas] = useState<HabilidadeMarcada[]>([]);

  const disciplina = disciplinas.find((d) => d.nome === nomeDisciplina);
  const ano = disciplina?.anos.find((a) => a.anoEscolar === anoEscolar && a.disponivel);
  const periodo = ano?.bimestres.find((b) => b.bimestre === bimestre);

  return {
    disciplinas,
    disciplina,
    ano,
    periodo,
    selecionadas,
    estaMarcada(codigo: string) {
      return selecionadas.some((item) => item.codigo === codigo);
    },
    escolherDisciplina(nome: string) {
      setNomeDisciplina(nome);
      setSelecionadas([]);
      // O ano continua escolhido se também existir na nova disciplina.
      const nova = disciplinas.find((d) => d.nome === nome);
      if (!nova?.anos.some((a) => a.anoEscolar === anoEscolar && a.disponivel)) setAnoEscolar("");
    },
    escolherAno: setAnoEscolar,
    escolherBimestre: setBimestre,
    /** Marca ou desmarca uma habilidade da lista que está na tela. */
    alternar(habilidade: HabilidadeDaLista) {
      if (!ano || !periodo) return;
      setSelecionadas((atuais) =>
        atuais.some((item) => item.codigo === habilidade.codigo)
          ? atuais.filter((item) => item.codigo !== habilidade.codigo)
          : atuais.length < LIMITS.habilidades
            ? [...atuais, { ...habilidade, anoEscolar: ano.anoEscolar, anoLabel: ano.label, bimestre: periodo.bimestre }]
            : atuais,
      );
    },
    desmarcar(codigo: string) {
      setSelecionadas((atuais) => atuais.filter((item) => item.codigo !== codigo));
    },
    /** Disciplina, códigos e o ano/bimestre que valem para todas as marcadas; null sem nenhuma marcada. */
    get pedido() {
      return disciplina && selecionadas.length > 0
        ? { componente: disciplina.nome, habilidades: selecionadas.map((item) => item.codigo), ...escopoDoPedido(selecionadas) }
        : null;
    },
    /** O formulário aparece com alguma habilidade marcada ou com uma lista para marcar na tela. */
    get mostrarFormulario() {
      return selecionadas.length > 0 || (periodo?.habilidades.length ?? 0) > 0;
    },
  };
}

export type SelecaoBncc = ReturnType<typeof useSelecaoBncc>;

export function FiltrosBncc({ selecao, pending }: { selecao: SelecaoBncc; pending: boolean }) {
  const { disciplinas, disciplina, ano, periodo } = selecao;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Field label="Disciplina" htmlFor="bncc-disciplina">
        <Select
          id="bncc-disciplina"
          value={disciplina?.nome ?? ""}
          onChange={(event) => selecao.escolherDisciplina(event.target.value)}
          disabled={pending}
        >
          {disciplinas.map((item) => (
            <option key={item.nome} value={item.nome} disabled={!item.disponivel}>
              {item.disponivel ? item.nome : `${item.nome} (em breve)`}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Ano" htmlFor="bncc-ano">
        <Select
          id="bncc-ano"
          value={ano?.anoEscolar ?? ""}
          onChange={(event) => selecao.escolherAno(event.target.value)}
          disabled={pending || !disciplina?.disponivel}
        >
          <option value="" disabled>
            Selecione o ano
          </option>
          {disciplina?.anos.map((item) => (
            <option key={item.anoEscolar} value={item.anoEscolar} disabled={!item.disponivel}>
              {item.disponivel ? item.label : `${item.label} (em breve)`}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Bimestre" htmlFor="bncc-bimestre">
        <Select
          id="bncc-bimestre"
          value={periodo?.bimestre ?? ""}
          onChange={(event) => selecao.escolherBimestre(event.target.value)}
          disabled={pending || !ano}
        >
          <option value="" disabled>
            Selecione o bimestre
          </option>
          {(ano?.bimestres ?? []).map((item) => (
            <option key={item.bimestre} value={item.bimestre}>
              {item.label}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

/** As habilidades já marcadas, de qualquer ano ou bimestre, com o botão de desmarcar. */
export function HabilidadesMarcadas({ selecao, pending }: { selecao: SelecaoBncc; pending: boolean }) {
  const { selecionadas } = selecao;
  if (selecionadas.length === 0) return null;
  const escopo = escopoDoPedido(selecionadas);

  return (
    <div className="space-y-1.5">
      <p className="text-sm font-bold">
        Marcadas{" "}
        <span className="font-normal text-muted-foreground">
          ({selecionadas.length} de {LIMITS.habilidades})
        </span>
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {selecionadas.map((habilidade) => (
          <li key={habilidade.codigo}>
            <span
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary-soft/50 py-0.5 pl-2.5 pr-1 text-xs"
              title={habilidade.descricao}
            >
              <span className="font-mono font-semibold">{habilidade.codigo}</span>
              <span className="text-muted-foreground">
                · {habilidade.anoLabel}, {habilidade.bimestre}º bim.
              </span>
              <button
                type="button"
                onClick={() => selecao.desmarcar(habilidade.codigo)}
                disabled={pending}
                className="flex size-5 items-center justify-center rounded-full hover:bg-primary/15 disabled:pointer-events-none disabled:opacity-50"
                aria-label={`Desmarcar ${habilidade.codigo}`}
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </span>
          </li>
        ))}
      </ul>
      {!escopo.bimestre ? (
        <p className="text-xs text-muted-foreground">
          {escopo.anoEscolar
            ? "Habilidades de bimestres diferentes: o cabeçalho sai sem bimestre."
            : "Habilidades de anos diferentes: o cabeçalho sai sem ano nem bimestre, como uma retomada."}
        </p>
      ) : null}
    </div>
  );
}

/** Dica enquanto ano e bimestre não foram escolhidos. */
export function DicaDosFiltros({ selecao }: { selecao: SelecaoBncc }) {
  return (
    <p className="flex items-center gap-2 rounded-xl border border-dashed border-input px-4 py-6 text-sm text-muted-foreground">
      <MousePointerClick className="size-4 shrink-0" aria-hidden />
      {selecao.ano
        ? "Selecione o bimestre para ver as habilidades da BNCC."
        : "Selecione o ano e o bimestre para ver as habilidades da BNCC."}
    </p>
  );
}

interface ListaDeHabilidadesProps {
  selecao: SelecaoBncc;
  pending: boolean;
  /** Ex.: "para o plano de aula", "para a prova". */
  finalidade: string;
}

export function ListaDeHabilidades({ selecao, pending, finalidade }: ListaDeHabilidadesProps) {
  const { disciplina, ano, periodo, selecionadas } = selecao;
  if (!disciplina || !ano || !periodo) return <DicaDosFiltros selecao={selecao} />;
  const habilidades: HabilidadeDaLista[] = periodo.habilidades;

  if (habilidades.length === 0) {
    return (
      <Alert variant="info" title="Nenhuma habilidade neste bimestre">
        A distribuição deste bimestre ainda não foi preenchida em <code>prisma/data/bncc-bimestres.json</code>.
      </Alert>
    );
  }

  const noLimite = selecionadas.length >= LIMITS.habilidades;

  return (
    <fieldset className="space-y-2">
      <legend className="space-y-0.5">
        <span className="block text-sm font-bold">
          Habilidades da BNCC · {disciplina.nome} · {ano.label} · {periodo.label}
        </span>
        <span className="block text-xs text-muted-foreground">
          Marque uma ou mais habilidades (até {LIMITS.habilidades} no total) {finalidade}.
        </span>
      </legend>
      <p className="flex gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
        <History className="mt-px size-4 shrink-0" aria-hidden />
        <span>
          Turma com defasagem? Troque o ano ou o bimestre e marque habilidades anteriores: as que você já marcou continuam
          marcadas.
        </span>
      </p>
      <ul className="space-y-2">
        {habilidades.map((habilidade) => {
          const marcada = selecao.estaMarcada(habilidade.codigo);
          const bloqueada = pending || (noLimite && !marcada);
          return (
            <li key={habilidade.codigo}>
              <label
                className={cn(
                  "flex cursor-pointer gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                  "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  marcada ? "border-primary bg-primary-soft/50" : "border-border bg-card hover:border-primary/50 hover:bg-accent",
                  bloqueada && "cursor-not-allowed hover:border-border hover:bg-card",
                  bloqueada && !marcada && "opacity-60",
                )}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={marcada}
                  disabled={bloqueada}
                  onChange={() => selecao.alternar(habilidade)}
                />
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border",
                    marcada ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card",
                  )}
                >
                  {marcada ? <Check className="size-3.5" /> : null}
                </span>
                <span className="min-w-0">
                  <Badge className="font-mono tracking-wide" title="Código oficial da BNCC">
                    <BookOpenCheck aria-hidden />
                    {habilidade.codigo}
                  </Badge>
                  <span className="mt-1.5 block text-sm leading-relaxed text-foreground/90">{habilidade.descricao}</span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

interface CampoComplementoProps {
  value: string;
  onChange: (value: string) => void;
  pending: boolean;
  error?: string;
  label: string;
  placeholder: string;
}

export function CampoComplemento({ value, onChange, pending, error, label, placeholder }: CampoComplementoProps) {
  return (
    <Field
      label={label}
      htmlFor="bncc-complemento"
      error={error}
      hint={`${value.length}/${LIMITS.complemento} caracteres. Não escreva nomes nem dados de alunos.`}
    >
      <Textarea
        id="bncc-complemento"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={LIMITS.complemento}
        rows={3}
        placeholder={placeholder}
        disabled={pending}
        {...fieldA11y("bncc-complemento", error)}
      />
    </Field>
  );
}

/** Mensagens que avançam com o tempo de espera. */
export function CarregandoGeracao({ etapas }: { etapas: readonly { ateMs: number; texto: string }[] }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 500);
    return () => window.clearInterval(timer);
  }, []);

  const etapa = etapas.find((item) => elapsed < item.ateMs) ?? etapas.at(-1)!;

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
