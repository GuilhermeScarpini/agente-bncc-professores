// De que ano e bimestre é o pedido, a partir das habilidades marcadas. O professor pode marcar
// habilidades de bimestres e anos diferentes (turma com defasagem retoma as anteriores), então o
// cabeçalho só leva o ano ou o bimestre quando todas vêm do mesmo lugar.
// Sem dependências de servidor: usado pelo formulário (navegador) e pelos testes.
import type { Bimestre } from "./bimestres";
import { findAnoEscolar } from "./codigos";

/** Habilidade marcada na lista, com o ano e o bimestre de onde veio. */
export interface HabilidadeMarcada {
  codigo: string;
  descricao: string;
  /** Valor de ANOS_ESCOLARES (ex.: "ef-3"). */
  anoEscolar: string;
  /** Ex.: "3º ano". */
  anoLabel: string;
  bimestre: Bimestre;
}

export interface EscopoDoPedido {
  anoEscolar?: string;
  bimestre?: Bimestre;
}

/** O ano mais avançado entre as marcadas ("ef-3", "3º ano"): a turma é a desse ano, retomando os anteriores. */
export function anoMaisAlto(
  marcadas: ReadonlyArray<Pick<HabilidadeMarcada, "anoEscolar" | "anoLabel">>,
): Pick<HabilidadeMarcada, "anoEscolar" | "anoLabel"> | null {
  // Pela escala do banco: "em-1" (10) vem depois de "ef-9".
  const numero = (item: Pick<HabilidadeMarcada, "anoEscolar">) => findAnoEscolar(item.anoEscolar)?.fim ?? 0;
  const maior = marcadas.reduce<(typeof marcadas)[number] | null>(
    (atual, item) => (!atual || numero(item) > numero(atual) ? item : atual),
    null,
  );
  return maior ? { anoEscolar: maior.anoEscolar, anoLabel: maior.anoLabel } : null;
}

/**
 * Todas do mesmo ano e bimestre: vão os dois. Mesmo ano, bimestres diferentes: só o ano.
 * Anos diferentes: nenhum dos dois (o agente aceita códigos de qualquer ano da disciplina).
 */
export function escopoDoPedido(marcadas: ReadonlyArray<Pick<HabilidadeMarcada, "anoEscolar" | "bimestre">>): EscopoDoPedido {
  const primeira = marcadas[0];
  if (!primeira || marcadas.some((item) => item.anoEscolar !== primeira.anoEscolar)) return {};
  return marcadas.every((item) => item.bimestre === primeira.bimestre)
    ? { anoEscolar: primeira.anoEscolar, bimestre: primeira.bimestre }
    : { anoEscolar: primeira.anoEscolar };
}
