// Plano de aula em PDF: o mesmo conteúdo da tela (e de formatarPlanoComoTexto), pronto para
// imprimir ou guardar.
import { AVISO_IA, type PlanoAula } from "@/lib/bncc/plano";
import { CINZA, DESTAQUE, MARGEM, TAMANHO, criarEscritor, type EscritorPdf } from "./escritor";

const RECUO = 16;

function secao(escritor: EscritorPdf, titulo: string): void {
  escritor.manterJunto(60);
  escritor.espaco(8);
  escritor.texto(titulo.toUpperCase(), { fonte: escritor.fontes.negrito, tamanho: TAMANHO.secao, cor: DESTAQUE });
  escritor.espaco(4);
}

export async function gerarPdfDoPlano(plano: PlanoAula): Promise<Uint8Array> {
  const escritor = await criarEscritor({ titulo: plano.titulo, assunto: "Plano de aula" });
  const { normal, negrito, italico } = escritor.fontes;
  const escolhida = plano.origem === "habilidade_escolhida";

  escritor.texto("PLANO DE AULA", { fonte: negrito, tamanho: TAMANHO.pequeno, cor: DESTAQUE });
  escritor.espaco(2);
  escritor.texto(plano.titulo, { fonte: negrito, tamanho: TAMANHO.titulo });
  escritor.espaco(4);

  const { componente, ano, bimestre } = plano.identificacao;
  const identificacao = [
    componente && `Componente curricular: ${componente}`,
    ano && `Ano: ${ano}`,
    bimestre && `Bimestre: ${bimestre}`,
    plano.duracao && `Duração: ${plano.duracao}`,
  ].filter((item): item is string => Boolean(item));
  if (identificacao.length > 0) escritor.texto(identificacao.join("   ·   "), { cor: CINZA });
  if (!escolhida) escritor.comPrefixo("Tema: ", plano.tema, { cor: CINZA });
  if (plano.complemento) escritor.comPrefixo("Orientações do professor: ", plano.complemento, { cor: CINZA });
  escritor.espaco(8);
  escritor.traco();
  escritor.espaco(4);

  if (plano.aviso) {
    escritor.espaco(6);
    escritor.comPrefixo("Atenção: ", plano.aviso, { tamanho: TAMANHO.alternativa });
  }

  secao(escritor, plano.habilidades.length === 1 ? "Habilidade da BNCC" : "Habilidades da BNCC");
  for (const habilidade of plano.habilidades) {
    escritor.manterJunto(escritor.altura(habilidade.descricao) + escritor.altura(habilidade.justificativa) + 24);
    escritor.texto(`${habilidade.codigo} · ${habilidade.componente}, ${habilidade.anoFaixa}`, { fonte: negrito });
    escritor.texto(habilidade.descricao, { fonte: italico, x: MARGEM + RECUO });
    if (habilidade.justificativa) {
      escritor.espaco(2);
      escritor.comPrefixo(escolhida ? "Como a aula desenvolve: " : "Por que: ", habilidade.justificativa, {
        tamanho: TAMANHO.alternativa,
        x: MARGEM + RECUO,
      });
    }
    escritor.espaco(8);
  }

  secao(escritor, "Objetivos de aprendizagem");
  for (const objetivo of plano.objetivos) {
    escritor.comPrefixo("•  ", objetivo, { x: MARGEM + 4, fontePrefixo: normal });
    escritor.espaco(2);
  }

  secao(escritor, "Metodologia");
  plano.metodologia.forEach((etapa, indice) => {
    const titulo = etapa.duracao ? `${etapa.titulo} (${etapa.duracao})` : etapa.titulo;
    escritor.manterJunto(escritor.altura(etapa.descricao) + 30);
    escritor.comPrefixo(`${indice + 1}. `, titulo, { fonte: negrito });
    escritor.texto(etapa.descricao, { x: MARGEM + RECUO });
    escritor.espaco(6);
  });

  secao(escritor, "Avaliação formativa");
  for (const item of plano.avaliacao) {
    escritor.comPrefixo(`${item.instrumento}: `, item.descricao);
    escritor.espaco(4);
  }

  escritor.espaco(14);
  escritor.texto(AVISO_IA, { fonte: italico, tamanho: TAMANHO.pequeno, cor: CINZA });
  escritor.rodape(plano.titulo);
  return escritor.pdf.save();
}
