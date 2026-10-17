// Estrutura dos códigos da BNCC. Sem dependências de servidor: o formulário do
// planejador usa as mesmas listas de componentes e anos que a validação e o seed.
//
//   EF 07 CI 04  →  etapa (EI/EF/EM) · ano ou faixa · componente · número
//   EF 67 LP 27  →  faixa "6º e 7º anos"      EI 03 EO 01 → "crianças pequenas"
//   EM 13 LGG 101 → "1ª a 3ª série" (área com 3 letras e 3 dígitos; Língua Portuguesa: EM13LP01)

export type EtapaSigla = "EI" | "EF" | "EM";

export const ETAPAS: Record<EtapaSigla, string> = {
  EI: "Educação Infantil",
  EF: "Ensino Fundamental",
  EM: "Ensino Médio",
};

/** Componentes curriculares (EF), campos de experiência (EI) e áreas (EM), pela sigla do código. */
const COMPONENTES_POR_SIGLA: Record<EtapaSigla, Record<string, string>> = {
  EI: {
    EO: "O eu, o outro e o nós",
    CG: "Corpo, gestos e movimentos",
    TS: "Traços, sons, cores e formas",
    EF: "Escuta, fala, pensamento e imaginação",
    ET: "Espaços, tempos, quantidades, relações e transformações",
  },
  EF: {
    LP: "Língua Portuguesa",
    AR: "Arte",
    EF: "Educação Física",
    LI: "Língua Inglesa",
    MA: "Matemática",
    CI: "Ciências",
    GE: "Geografia",
    HI: "História",
    ER: "Ensino Religioso",
  },
  EM: {
    LGG: "Linguagens e suas Tecnologias",
    LP: "Língua Portuguesa",
    MAT: "Matemática e suas Tecnologias",
    CNT: "Ciências da Natureza e suas Tecnologias",
    CHS: "Ciências Humanas e Sociais Aplicadas",
  },
};

/** Grupos do filtro "Disciplina" (Língua Portuguesa aparece no EF e no EM). */
export const GRUPOS_DE_COMPONENTES = [
  { etapa: "Ensino Fundamental", componentes: Object.values(COMPONENTES_POR_SIGLA.EF) },
  {
    etapa: "Ensino Médio",
    componentes: Object.values(COMPONENTES_POR_SIGLA.EM).filter((nome) => nome !== "Língua Portuguesa"),
  },
  { etapa: "Educação Infantil (campos de experiência)", componentes: Object.values(COMPONENTES_POR_SIGLA.EI) },
] as const;

export const COMPONENTES = [...new Set(GRUPOS_DE_COMPONENTES.flatMap((grupo) => grupo.componentes))] as [
  string,
  ...string[],
];

const FAIXAS_EI: Record<string, { rotulo: string; ano: number }> = {
  "01": { rotulo: "Bebês (zero a 1 ano e 6 meses)", ano: -2 },
  "02": { rotulo: "Crianças bem pequenas (1 ano e 7 meses a 3 anos e 11 meses)", ano: -1 },
  "03": { rotulo: "Crianças pequenas (4 anos a 5 anos e 11 meses)", ano: 0 },
};

export interface AnoEscolarOpcao {
  value: string;
  label: string;
  inicio: number;
  fim: number;
}

/** Opções do filtro "Ano escolar", na mesma escala de anoInicio/anoFim do banco. */
export const ANOS_ESCOLARES: readonly AnoEscolarOpcao[] = [
  { value: "ei-bebes", label: "Educação Infantil · Bebês", inicio: -2, fim: -2 },
  { value: "ei-bem-pequenas", label: "Educação Infantil · Crianças bem pequenas", inicio: -1, fim: -1 },
  { value: "ei-pequenas", label: "Educação Infantil · Crianças pequenas", inicio: 0, fim: 0 },
  ...Array.from({ length: 9 }, (_, index) => ({
    value: `ef-${index + 1}`,
    label: `${index + 1}º ano`,
    inicio: index + 1,
    fim: index + 1,
  })),
  { value: "em", label: "Ensino Médio", inicio: 10, fim: 12 },
];

export const ANOS_ESCOLARES_VALORES = ANOS_ESCOLARES.map((opcao) => opcao.value) as [string, ...string[]];

export function findAnoEscolar(value: string | undefined): AnoEscolarOpcao | undefined {
  return ANOS_ESCOLARES.find((opcao) => opcao.value === value);
}

export interface CodigoBncc {
  codigo: string;
  etapaSigla: EtapaSigla;
  etapa: string;
  anoInicio: number;
  anoFim: number;
  anoFaixa: string;
  componente: string;
}

const CODIGO_PATTERN = /^(EI|EF|EM)(\d{2})([A-Z]{2,3})(\d{2,3})$/;

/** Encontra códigos BNCC no meio de um texto (ex.: "...conforme EF07CI04."). */
export const CODIGO_BNCC_NO_TEXTO = /\b(?:EI0[1-3][A-Z]{2}\d{2}|EF\d{2}[A-Z]{2}\d{2}|EM13[A-Z]{2,3}\d{2,3})\b/g;

function faixaEnsinoFundamental(inicio: number, fim: number): string {
  if (inicio === fim) return `${inicio}º ano`;
  if (fim - inicio === 1) return `${inicio}º e ${fim}º anos`;
  return `${inicio}º ao ${fim}º ano`;
}

/** Interpreta um código oficial. Devolve null se o formato ou a sigla não existirem na BNCC. */
export function parseCodigoBncc(value: string): CodigoBncc | null {
  const codigo = value.trim().toUpperCase();
  const match = CODIGO_PATTERN.exec(codigo);
  if (!match) return null;
  const etapaSigla = match[1] as EtapaSigla;
  const [, , anos = "", sigla = "", numero = ""] = match;

  const componente = COMPONENTES_POR_SIGLA[etapaSigla][sigla];
  if (!componente) return null;
  const base = { codigo, etapaSigla, componente };

  if (etapaSigla === "EI") {
    const faixa = FAIXAS_EI[anos];
    if (!faixa || numero.length !== 2) return null;
    return { ...base, etapa: ETAPAS.EI, anoInicio: faixa.ano, anoFim: faixa.ano, anoFaixa: faixa.rotulo };
  }

  if (etapaSigla === "EM") {
    // Língua Portuguesa usa 2 dígitos (EM13LP01); as áreas usam 3 (EM13LGG101).
    if (anos !== "13" || numero.length !== (sigla === "LP" ? 2 : 3)) return null;
    return { ...base, etapa: ETAPAS.EM, anoInicio: 10, anoFim: 12, anoFaixa: "1ª a 3ª série" };
  }

  if (sigla.length !== 2 || numero.length !== 2) return null;
  // "07" = 7º ano; "67" = 6º e 7º anos; "15" = 1º ao 5º ano.
  const inicio = anos.startsWith("0") ? Number(anos[1]) : Number(anos[0]);
  const fim = Number(anos[1]);
  // Nenhuma habilidade atravessa a passagem dos Anos Iniciais (1º–5º) para os Finais (6º–9º).
  if (inicio < 1 || fim > 9 || inicio > fim || (inicio <= 5 && fim >= 6)) return null;

  return {
    ...base,
    etapa: `${ETAPAS.EF} – ${fim <= 5 ? "Anos Iniciais" : "Anos Finais"}`,
    anoInicio: inicio,
    anoFim: fim,
    anoFaixa: faixaEnsinoFundamental(inicio, fim),
  };
}
