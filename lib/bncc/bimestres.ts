// Distribuição das habilidades pelos bimestres (prisma/data/bncc-bimestres.json).
// A BNCC organiza as habilidades por ano; o bimestre vem do currículo da rede ou da
// escola, por isso fica num arquivo editável e é conferido aqui contra os códigos oficiais.
// Sem dependências de servidor: o formulário usa os mesmos rótulos.
import { z } from "zod";
import { anoEscolarDoNumero, parseCodigoBncc } from "./codigos";

export const BIMESTRES = ["1", "2", "3", "4"] as const;
export type Bimestre = (typeof BIMESTRES)[number];

export function rotuloBimestre(bimestre: Bimestre): string {
  return `${bimestre}º bimestre`;
}

export interface BimestreCalendario {
  bimestre: Bimestre;
  label: string;
  codigos: string[];
}

export interface AnoCalendario {
  ano: number;
  /** Valor de ANOS_ESCOLARES (ex.: "ef-3", "em-1"). */
  anoEscolar: string;
  label: string;
  /** Falso quando nenhum bimestre tem códigos: aparece como "em breve". */
  disponivel: boolean;
  bimestres: BimestreCalendario[];
}

export interface DisciplinaCalendario {
  nome: string;
  disponivel: boolean;
  anos: AnoCalendario[];
}

export interface CalendarioBimestral {
  disciplinas: DisciplinaCalendario[];
}

const arquivoSchema = z.object({
  // 1 a 9 = 1º ao 9º ano; 10 a 12 = 1ª a 3ª série do Ensino Médio.
  anos: z.array(z.number().int().min(1).max(12)).min(1),
  disciplinas: z
    .array(
      z.object({
        nome: z.string().trim().min(1),
        anos: z.record(z.string(), z.record(z.string(), z.array(z.string()))),
      }),
    )
    .min(1),
});

/** Valida o arquivo de bimestres e monta os menus. Lança um erro que lista todos os problemas. */
export function parseCalendario(dados: unknown): CalendarioBimestral {
  const parsed = arquivoSchema.safeParse(dados);
  if (!parsed.success) {
    throw new Error(`bncc-bimestres.json fora do formato: ${parsed.error.issues[0]?.message}`);
  }

  const problemas: string[] = [];
  const disciplinas = parsed.data.disciplinas.map(({ nome, anos: porAno }): DisciplinaCalendario => {
    for (const chave of Object.keys(porAno)) {
      if (!parsed.data.anos.includes(Number(chave))) problemas.push(`${nome}: ano "${chave}" não está na lista "anos".`);
    }

    // Cada disciplina mostra só os anos que têm chave nela (Língua Inglesa começa no 6º ano; as áreas
    // do Ensino Médio só têm as séries), na ordem da lista "anos".
    const doArquivo = parsed.data.anos.filter((ano) => Object.hasOwn(porAno, String(ano)));
    const anos = doArquivo.map((ano): AnoCalendario => {
      const opcao = anoEscolarDoNumero(ano)!;
      const porBimestre = porAno[String(ano)] ?? {};
      for (const chave of Object.keys(porBimestre)) {
        if (!BIMESTRES.includes(chave as Bimestre)) problemas.push(`${nome}, ${opcao.label}: bimestre "${chave}" inválido.`);
      }

      const vistos = new Set<string>();
      const bimestres = BIMESTRES.map((bimestre) => {
        const codigos = (porBimestre[bimestre] ?? []).map((codigo) => codigo.trim().toUpperCase());
        for (const codigo of codigos) {
          const info = parseCodigoBncc(codigo);
          const onde = `${nome}, ${opcao.label}, ${rotuloBimestre(bimestre)}`;
          if (!info) problemas.push(`${onde}: "${codigo}" não é um código BNCC válido.`);
          else if (info.componente !== nome) problemas.push(`${onde}: ${codigo} é de ${info.componente}.`);
          else if (ano < info.anoInicio || ano > info.anoFim) problemas.push(`${onde}: ${codigo} vale para ${info.anoFaixa}.`);
          if (vistos.has(codigo)) problemas.push(`${onde}: ${codigo} aparece mais de uma vez no ano.`);
          vistos.add(codigo);
        }
        return { bimestre, label: rotuloBimestre(bimestre), codigos };
      });

      return {
        ano,
        anoEscolar: opcao.value,
        label: opcao.label,
        disponivel: bimestres.some((item) => item.codigos.length > 0),
        bimestres,
      };
    });

    return { nome, disponivel: anos.some((ano) => ano.disponivel), anos };
  });

  if (problemas.length > 0) {
    throw new Error(`Problemas em prisma/data/bncc-bimestres.json:\n- ${problemas.join("\n- ")}`);
  }
  return { disciplinas };
}
