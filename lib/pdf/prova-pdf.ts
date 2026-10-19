// Prova em PDF, em duas versões: a dos alunos (só as questões, sem respostas nem códigos) e a do
// professor (cada questão com o código BNCC, a resposta e os critérios de correção).
import { AVISO_IA_PROVA, type ImagensDaProva, type ProvaAvaliacao, type QuestaoProva } from "@/lib/bncc/prova";
import {
  CERTO,
  CINZA,
  DESTAQUE,
  LARGURA_UTIL,
  MARGEM,
  TAMANHO,
  bytesDaDataUrl,
  criarEscritor,
  encaixarImagem,
  type EscritorPdf,
} from "./escritor";

export type VersaoDaProva = "alunos" | "professor";

/** Campos da prova que vão para o PDF (título e ano já com o que o professor escreveu). */
export type ProvaParaPdf = Pick<ProvaAvaliacao, "titulo" | "identificacao" | "instrucoes" | "questoes" | "habilidades" | "aviso">;

const RECUO_ALTERNATIVA = 18;
const CAIXA_DA_IMAGEM = { largura: 300, altura: 210 } as const;
const LINHAS_DA_DISCURSIVA = 3;
const ALTURA_DA_LINHA = 22;

function subtitulo(prova: ProvaParaPdf): string {
  return [prova.identificacao.componente, prova.identificacao.ano].filter(Boolean).join(" · ");
}

function cabecalho(escritor: EscritorPdf, prova: ProvaParaPdf, versao: VersaoDaProva): void {
  const { negrito, italico } = escritor.fontes;
  escritor.texto(prova.titulo, { fonte: negrito, tamanho: TAMANHO.titulo, centralizado: true });
  const linha = subtitulo(prova);
  if (linha) {
    escritor.espaco(2);
    escritor.texto(linha, { cor: CINZA, centralizado: true });
  }
  escritor.espaco(10);

  if (versao === "professor") {
    escritor.texto("VERSÃO DO PROFESSOR · COM GABARITO E HABILIDADES DA BNCC", {
      fonte: negrito,
      tamanho: TAMANHO.pequeno,
      cor: DESTAQUE,
      centralizado: true,
    });
    escritor.espaco(10);
  } else {
    escritor.texto("Nome: ____________________________________________     Data: ____/____/________");
    escritor.espaco(12);
  }
  escritor.traco();
  escritor.espaco(14);

  if (prova.instrucoes.length > 0) {
    escritor.texto("Instruções", { fonte: negrito, tamanho: TAMANHO.pequeno + 1 });
    escritor.espaco(2);
    for (const instrucao of prova.instrucoes) {
      escritor.comPrefixo("• ", instrucao, { tamanho: TAMANHO.pequeno + 1, fontePrefixo: italico, fonte: italico, cor: CINZA });
    }
    escritor.espaco(14);
  }
}

async function incorporarImagem(escritor: EscritorPdf, src: string) {
  const dados = bytesDaDataUrl(src);
  if (!dados) return null;
  if (dados.tipo === "image/png") return escritor.pdf.embedPng(dados.bytes);
  if (dados.tipo === "image/jpeg") return escritor.pdf.embedJpg(dados.bytes);
  return null;
}

function respostaDoGabarito(questao: QuestaoProva): string {
  return questao.tipo === "multipla_escolha" ? `alternativa ${questao.resposta}` : questao.resposta;
}

async function questao(
  escritor: EscritorPdf,
  item: QuestaoProva,
  imagens: ImagensDaProva,
  versao: VersaoDaProva,
): Promise<void> {
  const { normal, negrito } = escritor.fontes;
  const professor = versao === "professor";
  const prefixo = `${item.numero}. `;
  const xAlternativa = MARGEM + RECUO_ALTERNATIVA;
  const anexo = imagens[item.numero];
  const imagem = anexo ? await incorporarImagem(escritor, anexo.src) : null;
  const tamanhoDaImagem =
    imagem && anexo ? encaixarImagem(anexo.largura, anexo.altura, CAIXA_DA_IMAGEM.largura, CAIXA_DA_IMAGEM.altura) : null;

  const etiqueta = [item.habilidade, item.topico, item.tipo === "multipla_escolha" ? "Múltipla escolha" : "Discursiva"]
    .filter(Boolean)
    .join(" · ");

  // A questão inteira (etiqueta, enunciado, imagem e alternativas) fica na mesma página sempre que cabe.
  const alturaDasAlternativas = item.alternativas.reduce(
    (soma, alternativa) =>
      soma + escritor.alturaComPrefixo(`(${alternativa.letra}) `, alternativa.texto, { tamanho: TAMANHO.alternativa, x: xAlternativa }) + 3,
    0,
  );
  escritor.manterJunto(
    (professor ? escritor.altura(etiqueta, { tamanho: TAMANHO.pequeno }) + 4 : 0) +
      escritor.alturaComPrefixo(prefixo, item.enunciado) +
      (tamanhoDaImagem ? tamanhoDaImagem.altura + 12 : 0) +
      (item.tipo === "multipla_escolha" ? alturaDasAlternativas : LINHAS_DA_DISCURSIVA * ALTURA_DA_LINHA) +
      8,
  );

  if (professor) {
    escritor.texto(etiqueta, { fonte: negrito, tamanho: TAMANHO.pequeno, cor: DESTAQUE });
    escritor.espaco(4);
  }
  escritor.comPrefixo(prefixo, item.enunciado);
  escritor.espaco(6);

  if (imagem && tamanhoDaImagem) {
    escritor.imagem(imagem, tamanhoDaImagem.largura, tamanhoDaImagem.altura);
    escritor.espaco(10);
  }

  if (item.tipo === "multipla_escolha") {
    for (const alternativa of item.alternativas) {
      const correta = professor && alternativa.letra === item.resposta;
      escritor.comPrefixo(`(${alternativa.letra}) `, correta ? `${alternativa.texto} (correta)` : alternativa.texto, {
        tamanho: TAMANHO.alternativa,
        x: xAlternativa,
        fonte: correta ? negrito : normal,
        cor: correta ? CERTO : undefined,
      });
      escritor.espaco(3);
    }
  } else if (!professor) {
    for (let linha = 0; linha < LINHAS_DA_DISCURSIVA; linha += 1) {
      escritor.espaco(ALTURA_DA_LINHA);
      escritor.traco({ x: xAlternativa, largura: LARGURA_UTIL - RECUO_ALTERNATIVA });
    }
    escritor.espaco(4);
  }

  if (professor) {
    escritor.espaco(4);
    escritor.comPrefixo("Resposta: ", respostaDoGabarito(item), { tamanho: TAMANHO.alternativa, x: xAlternativa, cor: CERTO });
    if (item.criterios) {
      escritor.comPrefixo("Critérios: ", item.criterios, { tamanho: TAMANHO.alternativa, x: xAlternativa, cor: CINZA });
    }
  }
  escritor.espaco(14);
}

function habilidadesAvaliadas(escritor: EscritorPdf, prova: ProvaParaPdf): void {
  const { negrito, italico } = escritor.fontes;
  escritor.manterJunto(80);
  escritor.traco();
  escritor.espaco(12);
  escritor.texto("HABILIDADES DA BNCC AVALIADAS", { fonte: negrito, tamanho: TAMANHO.secao });
  escritor.espaco(6);
  for (const habilidade of prova.habilidades) {
    const numeros = prova.questoes.filter((q) => q.habilidade === habilidade.codigo).map((q) => q.numero);
    const onde = numeros.length > 0 ? `questões ${numeros.join(", ")}` : "nenhuma questão";
    escritor.manterJunto(escritor.altura(habilidade.descricao, { tamanho: TAMANHO.alternativa }) + 20);
    escritor.texto(`${habilidade.codigo} · ${habilidade.componente}, ${habilidade.anoFaixa} · ${onde}`, {
      fonte: negrito,
      tamanho: TAMANHO.alternativa,
    });
    escritor.texto(habilidade.descricao, { tamanho: TAMANHO.alternativa, cor: CINZA });
    escritor.espaco(8);
  }
  if (prova.aviso) {
    escritor.espaco(4);
    escritor.comPrefixo("Atenção: ", prova.aviso, { tamanho: TAMANHO.alternativa });
  }
  escritor.espaco(8);
  escritor.texto(AVISO_IA_PROVA, { fonte: italico, tamanho: TAMANHO.pequeno, cor: CINZA });
}

/** PDF da prova na versão pedida, com as imagens que o professor anexou. */
export async function gerarPdfDaProva(
  prova: ProvaParaPdf,
  { versao, imagens = {} }: { versao: VersaoDaProva; imagens?: ImagensDaProva },
): Promise<Uint8Array> {
  const escritor = await criarEscritor({
    titulo: versao === "professor" ? `${prova.titulo} (professor)` : prova.titulo,
    assunto: versao === "professor" ? "Prova com gabarito e habilidades da BNCC" : "Prova",
  });
  cabecalho(escritor, prova, versao);
  for (const item of prova.questoes) await questao(escritor, item, imagens, versao);
  if (versao === "professor") habilidadesAvaliadas(escritor, prova);
  escritor.rodape(versao === "professor" ? `${prova.titulo} · versão do professor` : prova.titulo);
  return escritor.pdf.save();
}
