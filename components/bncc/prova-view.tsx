"use client";

import {
  BookOpenCheck,
  Check,
  Copy,
  Eye,
  EyeOff,
  FileDown,
  ImagePlus,
  ListChecks,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useId, useMemo, useRef, useState, useTransition, type ChangeEvent, type ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { useBaixarPdf } from "@/hooks/use-baixar-pdf";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import type { HabilidadeMarcada } from "@/lib/bncc/escopo";
import type { HabilidadeConsultada } from "@/lib/bncc/plano";
import {
  AVISO_IA_PROVA,
  formatarGabaritoComoTexto,
  formatarProvaComoHtml,
  formatarProvaComoTexto,
  questaoEmBranco,
  type ImagemDaQuestao,
  type ProvaGerada,
  type QuestaoProva,
} from "@/lib/bncc/prova";
import { ImagemInvalidaError, prepararImagem } from "@/lib/imagem";
import { nomeDeArquivo } from "@/lib/pdf/quebra";
import { cn } from "@/lib/utils";
import { EditorDeQuestao } from "./editor-de-questao";

/** Questão na lista da tela, com um id fixo (o número muda quando o professor exclui ou adiciona). */
interface ItemDaProva {
  id: string;
  questao: QuestaoProva;
  imagem?: ImagemDaQuestao;
}

let ultimoId = 0;
const novoId = () => `questao-${++ultimoId}`;
const itensDa = (prova: ProvaGerada): ItemDaProva[] => prova.questoes.map((questao) => ({ id: novoId(), questao }));

interface ProvaViewProps {
  prova: ProvaGerada;
  /** Ano mais avançado entre as habilidades do pedido: sugere o ano do cabeçalho e limita a busca de códigos. */
  anoDaTurma?: Pick<HabilidadeMarcada, "anoEscolar" | "anoLabel"> | null;
  /** Rota da busca de habilidades para as questões escritas à mão. */
  endpointBusca?: string;
}

/**
 * Prova gerada, com o gabarito escondido até o professor pedir. O professor muda o título e o ano
 * (o cabeçalho não leva bimestre), edita, exclui e adiciona questões e anexa uma imagem a cada uma.
 */
export function ProvaView({ prova, anoDaTurma = null, endpointBusca }: ProvaViewProps) {
  const anoSugerido = prova.identificacao.ano ?? anoDaTurma?.anoLabel ?? "";
  const [comGabarito, setComGabarito] = useState(false);
  const [itens, setItens] = useState(() => itensDa(prova));
  const [titulo, setTitulo] = useState(prova.titulo);
  const [ano, setAno] = useState(anoSugerido);
  /** Questão aberta no editor (id) ou a nova que está sendo escrita. */
  const [editando, setEditando] = useState<string | null>(null);
  const [nova, setNova] = useState<string | null>(null);
  /** Habilidades achadas na busca para as questões editadas (o texto oficial vai para o PDF). */
  const [achadas, setAchadas] = useState<Record<string, HabilidadeConsultada>>({});
  // Prova nova: as questões, as imagens, o título e o ano eram da anterior.
  const [provaAtual, setProvaAtual] = useState(prova);
  if (provaAtual !== prova) {
    setProvaAtual(prova);
    setItens(itensDa(prova));
    setTitulo(prova.titulo);
    setAno(anoSugerido);
    setEditando(null);
    setNova(null);
    setAchadas({});
  }
  const { gerando, erro: erroDoPdf, baixar } = useBaixarPdf();
  const editorAberto = editando !== null || nova !== null;

  const conhecidas = useMemo(() => {
    const mapa = new Map<string, HabilidadeConsultada>();
    for (const habilidade of [...prova.consultadas, ...prova.habilidades, ...Object.values(achadas)]) {
      mapa.set(habilidade.codigo, habilidade);
    }
    return mapa;
  }, [prova, achadas]);

  /**
   * A prova como o professor deixou: título e ano dele, sem bimestre, questões renumeradas e as
   * habilidades novas que entraram pela edição. É o que vai para os PDFs e as cópias.
   */
  const provaFinal = useMemo(() => {
    const questoes = itens.map((item, indice) => ({ ...item.questao, numero: indice + 1 }));
    const codigos = new Set(prova.habilidades.map((h) => h.codigo));
    const novas = [...new Set(questoes.map((q) => q.habilidade))].flatMap((codigo) => {
      const habilidade = codigo && !codigos.has(codigo) ? conhecidas.get(codigo) : undefined;
      return habilidade ? [habilidade] : [];
    });
    return {
      ...prova,
      titulo: titulo.trim() || prova.titulo,
      identificacao: { ...prova.identificacao, ano: ano.trim() || null, bimestre: null },
      questoes,
      habilidades: [...prova.habilidades, ...novas],
    };
  }, [prova, itens, titulo, ano, conhecidas]);
  const imagens = useMemo(
    () => Object.fromEntries(itens.flatMap((item, indice) => (item.imagem ? [[indice + 1, item.imagem]] : []))),
    [itens],
  );
  const temImagens = Object.keys(imagens).length > 0;
  const semQuestoes = provaFinal.questoes.length === 0;

  function baixarPdf(versao: "alunos" | "professor") {
    void baixar(
      versao,
      async () => (await import("@/lib/pdf/prova-pdf")).gerarPdfDaProva(provaFinal, { versao, imagens }),
      nomeDeArquivo(versao === "professor" ? "prova-professor" : "prova-alunos", provaFinal.titulo),
    );
  }

  function mudarItem(id: string, campos: Partial<ItemDaProva>) {
    setItens((atuais) => atuais.map((item) => (item.id === id ? { ...item, ...campos } : item)));
  }

  function guardarHabilidade(habilidade: HabilidadeConsultada | null) {
    if (habilidade && !conhecidas.has(habilidade.codigo)) setAchadas((atuais) => ({ ...atuais, [habilidade.codigo]: habilidade }));
  }

  function salvarQuestao(id: string, questao: QuestaoProva, habilidade: HabilidadeConsultada | null) {
    guardarHabilidade(habilidade);
    mudarItem(id, { questao });
    setEditando(null);
  }

  function adicionarQuestao(questao: QuestaoProva, habilidade: HabilidadeConsultada | null) {
    guardarHabilidade(habilidade);
    setItens((atuais) => [...atuais, { id: novoId(), questao }]);
    setNova(null);
  }

  function excluirQuestao(id: string, numero: number) {
    if (!window.confirm(`Excluir a questão ${numero}? Não dá para desfazer.`)) return;
    setItens((atuais) => atuais.filter((item) => item.id !== id));
  }

  const objetivas = provaFinal.questoes.filter((q) => q.tipo === "multipla_escolha").length;
  const editorProps = {
    endpointBusca,
    componente: prova.identificacao.componente,
    anoMaximo: anoDaTurma?.anoEscolar ?? null,
  };

  return (
    <article className="space-y-5" aria-label="Prova gerada">
      <header className="space-y-2">
        <div className="flex flex-wrap gap-1.5">
          {provaFinal.habilidades.map((habilidade) => (
            <CodigoBadge key={habilidade.codigo} codigo={habilidade.codigo} />
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
          <Field label="Título da prova" htmlFor="prova-titulo" hint="Sugestão da IA: mude se quiser.">
            <Input
              id="prova-titulo"
              value={titulo}
              onChange={(event) => setTitulo(event.target.value)}
              maxLength={160}
              className="font-semibold"
            />
          </Field>
          <Field label="Ano" htmlFor="prova-ano">
            <Input
              id="prova-ano"
              value={ano}
              onChange={(event) => setAno(event.target.value)}
              maxLength={40}
              placeholder="Ex.: 3º ano"
            />
          </Field>
        </div>
        {prova.identificacao.componente ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Componente curricular: </span>
            <span className="font-semibold">{prova.identificacao.componente}</span>
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          {provaFinal.questoes.length} {provaFinal.questoes.length === 1 ? "questão" : "questões"} · {objetivas} de múltipla
          escolha · {provaFinal.questoes.length - objetivas} discursivas
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
        {itens.map((item, indice) =>
          item.id === editando ? (
            <EditorDeQuestao
              key={item.id}
              inicial={item.questao}
              habilidadeInicial={conhecidas.get(item.questao.habilidade) ?? null}
              numero={indice + 1}
              onSalvar={(questao, habilidade) => salvarQuestao(item.id, questao, habilidade)}
              onCancelar={() => setEditando(null)}
              {...editorProps}
            />
          ) : (
            <Questao
              key={item.id}
              questao={{ ...item.questao, numero: indice + 1 }}
              comGabarito={comGabarito}
              imagem={item.imagem}
              onImagem={(imagem) => mudarItem(item.id, { imagem: imagem ?? undefined })}
              bloqueada={editorAberto}
              onEditar={() => setEditando(item.id)}
              onExcluir={() => excluirQuestao(item.id, indice + 1)}
            />
          ),
        )}
        {nova ? (
          <EditorDeQuestao
            key={nova}
            inicial={questaoEmBranco()}
            habilidadeInicial={null}
            numero={itens.length + 1}
            onSalvar={adicionarQuestao}
            onCancelar={() => setNova(null)}
            {...editorProps}
          />
        ) : null}
      </ol>

      <Button variant="outline" className="w-full border-dashed" onClick={() => setNova(novoId())} disabled={editorAberto}>
        <Plus className="size-4" aria-hidden />
        Adicionar questão
      </Button>

      <details className="rounded-xl border border-border px-3 py-2 text-sm">
        <summary className="font-semibold text-muted-foreground">Habilidades avaliadas ({provaFinal.habilidades.length})</summary>
        <ul className="mt-2 space-y-2 pb-1">
          {provaFinal.habilidades.map((habilidade) => (
            <li key={habilidade.codigo}>
              <span className="font-mono text-xs font-semibold">{habilidade.codigo}</span>{" "}
              <span className="text-xs text-muted-foreground">
                ({habilidade.componente} · {habilidade.anoFaixa} ·{" "}
                {provaFinal.questoes.filter((q) => q.habilidade === habilidade.codigo).length} questões)
              </span>
              <p className="text-foreground/80">{habilidade.descricao}</p>
            </li>
          ))}
        </ul>
      </details>

      <p className="text-xs text-muted-foreground">{AVISO_IA_PROVA}</p>
      {temImagens ? (
        <p className="text-xs text-muted-foreground">
          As imagens ficam só neste navegador: somem se você gerar outra prova ou recarregar a página. Para guardar,
          baixe o PDF ou copie a prova para um documento.
        </p>
      ) : null}

      <div className="space-y-3 border-t border-border pt-4">
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={() => baixarPdf("professor")}
            loading={gerando === "professor"}
            disabled={gerando !== null || semQuestoes}
          >
            {gerando === "professor" ? null : <FileDown className="size-4" aria-hidden />}
            Baixar para o professor
          </Button>
          <Button onClick={() => baixarPdf("alunos")} loading={gerando === "alunos"} disabled={gerando !== null || semQuestoes}>
            {gerando === "alunos" ? null : <FileDown className="size-4" aria-hidden />}
            Baixar para os alunos
          </Button>
        </div>
        <p className="text-xs text-muted-foreground sm:text-right">
          {semQuestoes
            ? "Adicione ao menos uma questão para baixar a prova."
            : editorAberto
              ? "Salve a questão que está editando para ela entrar no PDF."
              : "PDF dos alunos: só as questões. PDF do professor: com o gabarito e o código BNCC de cada questão."}
        </p>
        {erroDoPdf ? <Alert variant="error">{erroDoPdf}</Alert> : null}
        <div className="flex flex-wrap gap-1 sm:justify-end">
          <BotaoCopiar texto={formatarGabaritoComoTexto(provaFinal)} rotulo="Copiar gabarito" />
          <BotaoCopiar
            texto={formatarProvaComoTexto(provaFinal)}
            // Com imagens, copia também a versão formatada, que o editor de texto cola com as imagens.
            html={temImagens ? formatarProvaComoHtml(provaFinal, imagens) : undefined}
            rotulo="Copiar prova (sem gabarito)"
          />
        </div>
      </div>
    </article>
  );
}

interface QuestaoProps {
  questao: QuestaoProva;
  comGabarito: boolean;
  imagem: ImagemDaQuestao | undefined;
  onImagem: (imagem: ImagemDaQuestao | null) => void;
  /** Outra questão está aberta no editor. */
  bloqueada: boolean;
  onEditar: () => void;
  onExcluir: () => void;
}

function Questao({ questao, comGabarito, imagem, onImagem, bloqueada, onEditar, onExcluir }: QuestaoProps) {
  return (
    <li className="space-y-2 rounded-xl border border-border p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
          {questao.numero}
        </span>
        {questao.habilidade ? (
          <CodigoBadge codigo={questao.habilidade} />
        ) : (
          <span className="text-xs text-muted-foreground">Sem código BNCC</span>
        )}
        <span className="text-xs font-semibold text-muted-foreground">
          {questao.tipo === "multipla_escolha" ? "Múltipla escolha" : "Discursiva"}
        </span>
        <span className="ml-auto flex gap-0.5">
          <Button variant="ghost" size="sm" onClick={onEditar} disabled={bloqueada} aria-label={`Editar a questão ${questao.numero}`}>
            <Pencil className="size-4" aria-hidden />
            <span className="hidden sm:inline">Editar</span>
          </Button>
          <Button
            variant="destructive-ghost"
            size="sm"
            onClick={onExcluir}
            disabled={bloqueada}
            aria-label={`Excluir a questão ${questao.numero}`}
          >
            <Trash2 className="size-4" aria-hidden />
            <span className="hidden sm:inline">Excluir</span>
          </Button>
        </span>
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed">{questao.enunciado}</p>
      <CampoImagem numero={questao.numero} imagem={imagem} onImagem={onImagem} />

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

interface CampoImagemProps {
  numero: number;
  imagem: ImagemDaQuestao | undefined;
  onImagem: (imagem: ImagemDaQuestao | null) => void;
}

/** Imagem opcional da questão, escolhida do computador: aparece na tela, na impressão e na cópia. */
function CampoImagem({ numero, imagem, onImagem }: CampoImagemProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const descricaoId = useId();
  const [erro, setErro] = useState<string | null>(null);
  const [preparando, startPreparando] = useTransition();

  function escolher(event: ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    event.target.value = "";
    if (!arquivo) return;
    setErro(null);
    startPreparando(async () => {
      try {
        // Imagem nova: a descrição da anterior não vale mais.
        onImagem({ ...(await prepararImagem(arquivo)), descricao: "" });
      } catch (error) {
        setErro(error instanceof ImagemInvalidaError ? error.message : "Não foi possível usar esta imagem.");
      }
    });
  }

  const seletor = (
    <input
      ref={inputRef}
      type="file"
      accept="image/png,image/jpeg,image/webp,image/gif"
      className="sr-only"
      tabIndex={-1}
      aria-hidden
      onChange={escolher}
    />
  );
  const escolherArquivo = () => inputRef.current?.click();

  if (!imagem) {
    return (
      <div className="space-y-1">
        {seletor}
        <Button variant="ghost" size="sm" className="-ml-2" onClick={escolherArquivo} disabled={preparando}>
          {preparando ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />}
          {preparando ? "Preparando a imagem…" : "Adicionar imagem"}
        </Button>
        {erro ? <p className="text-xs text-destructive">{erro}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {seletor}
      <img
        src={imagem.src}
        alt={imagem.descricao || `Imagem da questão ${numero}`}
        width={imagem.largura}
        height={imagem.altura}
        className="h-auto max-h-72 w-auto max-w-full rounded-lg border border-border bg-white object-contain"
      />
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label htmlFor={descricaoId} className="sr-only">
          Descrição da imagem da questão {numero}
        </label>
        <Input
          id={descricaoId}
          value={imagem.descricao}
          onChange={(event) => onImagem({ ...imagem, descricao: event.target.value })}
          maxLength={300}
          placeholder="Descrição da imagem, para quem não enxerga (opcional)"
          className="h-9 flex-1"
        />
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={escolherArquivo} disabled={preparando}>
            {preparando ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : <RefreshCw className="size-4" aria-hidden />}
            Trocar
          </Button>
          <Button variant="destructive-ghost" size="sm" onClick={() => onImagem(null)} disabled={preparando}>
            <Trash2 className="size-4" aria-hidden />
            Remover
          </Button>
        </div>
      </div>
      {erro ? <p className="text-xs text-destructive">{erro}</p> : null}
    </div>
  );
}

interface BotaoCopiarProps {
  texto: string;
  /** Versão formatada (com imagens), copiada junto com o texto. */
  html?: string;
  rotulo: string;
}

function BotaoCopiar({ texto, html, rotulo }: BotaoCopiarProps) {
  const { copied, copy } = useCopyToClipboard();
  return (
    <Button variant="ghost" size="sm" onClick={() => copy(texto, html)}>
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
