"use client";

// Peças comuns ao planejador de aulas e ao gerador de provas: os menus disciplina → ano → bimestre,
// a lista de habilidades com seleção múltipla, o campo de complemento e o indicador de carregamento.
import { BookOpenCheck, Check, LoaderCircle, MousePointerClick } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Field, Select, Textarea, fieldA11y } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/page-elements";
import type { DisciplinaComHabilidades, HabilidadeDaLista } from "@/lib/bncc/calendario";
import { LIMITS } from "@/lib/limits";
import { cn } from "@/lib/utils";

/** Estado dos menus e das habilidades marcadas. A seleção vale para a lista que está na tela. */
export function useSelecaoBncc(disciplinas: DisciplinaComHabilidades[]) {
  const [nomeDisciplina, setNomeDisciplina] = useState(() => disciplinas.find((d) => d.disponivel)?.nome ?? "");
  const [anoEscolar, setAnoEscolar] = useState("");
  const [bimestre, setBimestre] = useState("");
  const [selecionadas, setSelecionadas] = useState<string[]>([]);

  const disciplina = disciplinas.find((d) => d.nome === nomeDisciplina);
  const ano = disciplina?.anos.find((a) => a.anoEscolar === anoEscolar && a.disponivel);
  const periodo = ano?.bimestres.find((b) => b.bimestre === bimestre);

  return {
    disciplinas,
    disciplina,
    ano,
    periodo,
    selecionadas,
    escolherDisciplina(nome: string) {
      setNomeDisciplina(nome);
      setSelecionadas([]);
      // O ano continua escolhido se também existir na nova disciplina.
      const nova = disciplinas.find((d) => d.nome === nome);
      if (!nova?.anos.some((a) => a.anoEscolar === anoEscolar && a.disponivel)) setAnoEscolar("");
    },
    escolherAno(valor: string) {
      setAnoEscolar(valor);
      setSelecionadas([]);
    },
    escolherBimestre(valor: string) {
      setBimestre(valor);
      setSelecionadas([]);
    },
    alternar(codigo: string) {
      setSelecionadas((atuais) =>
        atuais.includes(codigo)
          ? atuais.filter((item) => item !== codigo)
          : atuais.length < LIMITS.habilidades
            ? [...atuais, codigo]
            : atuais,
      );
    },
    /** Disciplina, ano e bimestre do pedido, quando os três estão escolhidos. */
    get filtros() {
      return disciplina && ano && periodo
        ? { componente: disciplina.nome, anoEscolar: ano.anoEscolar, bimestre: periodo.bimestre }
        : null;
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
  if (!disciplina || !ano || !periodo) return null;
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
          Marque uma ou mais habilidades (até {LIMITS.habilidades}) {finalidade}.
          {selecionadas.length > 0 ? ` ${selecionadas.length} selecionada${selecionadas.length === 1 ? "" : "s"}.` : ""}
        </span>
      </legend>
      <ul className="space-y-2">
        {habilidades.map((habilidade) => {
          const marcada = selecionadas.includes(habilidade.codigo);
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
                  onChange={() => selecao.alternar(habilidade.codigo)}
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
