import "server-only";
import { prisma } from "@/lib/db";
import dados from "@/prisma/data/bncc-bimestres.json";
import { parseCalendario, type AnoCalendario, type BimestreCalendario, type DisciplinaCalendario } from "./bimestres";

export interface HabilidadeDaLista {
  codigo: string;
  descricao: string;
}

export interface BimestreComHabilidades extends Omit<BimestreCalendario, "codigos"> {
  habilidades: HabilidadeDaLista[];
}

export interface AnoComHabilidades extends Omit<AnoCalendario, "bimestres"> {
  bimestres: BimestreComHabilidades[];
}

export interface DisciplinaComHabilidades extends Omit<DisciplinaCalendario, "anos"> {
  anos: AnoComHabilidades[];
}

/** Menus do planejador (disciplina → ano → bimestre) com o texto oficial de cada habilidade. */
export async function getCalendarioComHabilidades(): Promise<DisciplinaComHabilidades[]> {
  const { disciplinas } = parseCalendario(dados);
  const codigos = disciplinas.flatMap((d) => d.anos.flatMap((a) => a.bimestres.flatMap((b) => b.codigos)));
  const registros = await prisma.bnccHabilidade.findMany({
    where: { id: { in: [...new Set(codigos)] } },
    select: { id: true, descricao: true },
  });
  const descricoes = new Map(registros.map((registro) => [registro.id, registro.descricao]));

  // Códigos que ainda não estão no banco (seed pendente) ficam fora da lista.
  return disciplinas.map((disciplina) => ({
    ...disciplina,
    anos: disciplina.anos.map((ano) => ({
      ...ano,
      bimestres: ano.bimestres.map(({ codigos: doBimestre, ...bimestre }) => ({
        ...bimestre,
        habilidades: doBimestre.flatMap((codigo) => {
          const descricao = descricoes.get(codigo);
          return descricao ? [{ codigo, descricao }] : [];
        }),
      })),
    })),
  }));
}
