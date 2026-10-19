// Escritor de PDF dos planos e das provas: texto com quebra de linha, quebra de página, imagens e
// rodapé com o número da página. Roda no navegador (as imagens das questões só existem lá) e nos
// testes. Adaptado do escritor do turma-social (lib/exams/print/pdf-writer.ts).
import { PDFDocument, StandardFonts, rgb, type Color, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";
import { quebrarTexto } from "./quebra";

// A4 em pontos, margens de ~1,8 cm.
export const PAGINA = { largura: 595.28, altura: 841.89 } as const;
export const MARGEM = 50;
export const LARGURA_UTIL = PAGINA.largura - MARGEM * 2;
export const TAMANHO = { titulo: 16, secao: 11, corpo: 11, alternativa: 10.5, pequeno: 8.5 } as const;
export const ENTRELINHA = 1.35;
export const PRETO = rgb(0, 0, 0);
export const CINZA = rgb(0.4, 0.4, 0.4);
export const DESTAQUE = rgb(0.16, 0.33, 0.7);
export const CERTO = rgb(0.08, 0.45, 0.22);
const CINZA_CLARO = rgb(0.72, 0.72, 0.72);
/** Altura reservada para o rodapé. */
const RODAPE = 14;

/** Trocas para símbolos que as fontes padrão do PDF (Helvetica, WinAnsi) não têm. */
const TROCAS: Record<string, string> = {
  "→": "->",
  "←": "<-",
  "≥": ">=",
  "≤": "<=",
  "≠": "!=",
  "√": "raiz de ",
  "π": "pi",
  "−": "-",
  " ": " ",
  "\t": "    ",
};

export interface Fontes {
  normal: PDFFont;
  negrito: PDFFont;
  italico: PDFFont;
}

interface OpcoesDeTexto {
  fonte?: PDFFont;
  tamanho?: number;
  x?: number;
  largura?: number;
  cor?: Color;
  centralizado?: boolean;
}

/** Deixa só os caracteres que a fonte desenha (o resto vira "?"). */
function limpador(fonte: PDFFont): (texto: string) => string {
  const suportados = new Set(fonte.getCharacterSet());
  return (texto) =>
    Array.from(texto, (caractere) => {
      if (caractere === "\n") return caractere;
      const troca = TROCAS[caractere];
      if (troca !== undefined) return troca;
      return suportados.has(caractere.codePointAt(0) ?? 0) ? caractere : "?";
    }).join("");
}

/** Cabe a imagem na caixa, sem aumentar. */
export function encaixarImagem(largura: number, altura: number, maxLargura: number, maxAltura: number) {
  const escala = Math.min(1, maxLargura / largura, maxAltura / altura);
  return { largura: Math.max(1, Math.round(largura * escala)), altura: Math.max(1, Math.round(altura * escala)) };
}

export class EscritorPdf {
  private pagina!: PDFPage;
  private y = 0;
  readonly paginas: PDFPage[] = [];
  private readonly limpar: (texto: string) => string;

  constructor(
    readonly pdf: PDFDocument,
    readonly fontes: Fontes,
  ) {
    this.limpar = limpador(fontes.normal);
    this.novaPagina();
  }

  novaPagina(): void {
    this.pagina = this.pdf.addPage([PAGINA.largura, PAGINA.altura]);
    this.paginas.push(this.pagina);
    this.y = PAGINA.altura - MARGEM;
  }

  get restante(): number {
    return this.y - MARGEM - RODAPE;
  }

  /** Começa outra página se o bloco não couber (e couber numa página vazia). */
  manterJunto(altura: number): void {
    if (altura > this.restante && altura <= PAGINA.altura - MARGEM * 2 - RODAPE) this.novaPagina();
  }

  linhas(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
    return quebrarTexto(this.limpar(texto), (valor) => fonte.widthOfTextAtSize(valor, tamanho), largura);
  }

  altura(texto: string, { fonte = this.fontes.normal, tamanho = TAMANHO.corpo as number, largura = LARGURA_UTIL } = {}): number {
    return this.linhas(texto, fonte, tamanho, largura).length * tamanho * ENTRELINHA;
  }

  espaco(pontos: number): void {
    this.y -= pontos;
  }

  texto(
    texto: string,
    {
      fonte = this.fontes.normal,
      tamanho = TAMANHO.corpo,
      x = MARGEM,
      largura = LARGURA_UTIL - (x - MARGEM),
      cor = PRETO,
      centralizado = false,
    }: OpcoesDeTexto = {},
  ): void {
    for (const linha of this.linhas(texto, fonte, tamanho, largura)) {
      if (tamanho * ENTRELINHA > this.restante) this.novaPagina();
      const larguraDaLinha = fonte.widthOfTextAtSize(linha, tamanho);
      const esquerda = centralizado ? MARGEM + (LARGURA_UTIL - larguraDaLinha) / 2 : x;
      this.pagina.drawText(linha, { x: esquerda, y: this.y - tamanho, size: tamanho, font: fonte, color: cor });
      this.y -= tamanho * ENTRELINHA;
    }
  }

  /** Texto com um prefixo ("3. ", "(B) ", "Critérios: ") e o resto alinhado depois dele. */
  comPrefixo(
    prefixo: string,
    texto: string,
    {
      tamanho = TAMANHO.corpo as number,
      x = MARGEM,
      fontePrefixo = this.fontes.negrito,
      fonte = this.fontes.normal,
      cor = PRETO,
    }: { tamanho?: number; x?: number; fontePrefixo?: PDFFont; fonte?: PDFFont; cor?: Color } = {},
  ): void {
    const larguraDoPrefixo = fontePrefixo.widthOfTextAtSize(prefixo, tamanho);
    const linhas = this.linhas(texto, fonte, tamanho, LARGURA_UTIL - (x - MARGEM) - larguraDoPrefixo);
    linhas.forEach((linha, indice) => {
      if (tamanho * ENTRELINHA > this.restante) this.novaPagina();
      if (indice === 0) {
        this.pagina.drawText(prefixo, { x, y: this.y - tamanho, size: tamanho, font: fontePrefixo, color: cor });
      }
      this.pagina.drawText(linha, { x: x + larguraDoPrefixo, y: this.y - tamanho, size: tamanho, font: fonte, color: cor });
      this.y -= tamanho * ENTRELINHA;
    });
  }

  alturaComPrefixo(
    prefixo: string,
    texto: string,
    { tamanho = TAMANHO.corpo as number, x = MARGEM, fontePrefixo = this.fontes.negrito, fonte = this.fontes.normal } = {},
  ): number {
    const larguraDoPrefixo = fontePrefixo.widthOfTextAtSize(prefixo, tamanho);
    return this.linhas(texto, fonte, tamanho, LARGURA_UTIL - (x - MARGEM) - larguraDoPrefixo).length * tamanho * ENTRELINHA;
  }

  /** Imagem centralizada. */
  imagem(imagem: PDFImage, largura: number, altura: number): void {
    if (altura > this.restante) this.novaPagina();
    this.pagina.drawImage(imagem, { x: MARGEM + (LARGURA_UTIL - largura) / 2, y: this.y - altura, width: largura, height: altura });
    this.y -= altura;
  }

  /** Linha horizontal na altura atual (não move o cursor). */
  traco({ x = MARGEM, largura = LARGURA_UTIL, cor = CINZA_CLARO, espessura = 0.6 } = {}): void {
    this.pagina.drawLine({ start: { x, y: this.y }, end: { x: x + largura, y: this.y }, thickness: espessura, color: cor });
  }

  /** Rodapé de todas as páginas: o texto à esquerda e "Página 1 de 3" à direita. */
  rodape(esquerda = ""): void {
    this.paginas.forEach((pagina, indice) => {
      const rotulo = `Página ${indice + 1} de ${this.paginas.length}`;
      const largura = this.fontes.normal.widthOfTextAtSize(rotulo, TAMANHO.pequeno);
      const y = MARGEM / 2;
      pagina.drawText(rotulo, { x: PAGINA.largura - MARGEM - largura, y, size: TAMANHO.pequeno, font: this.fontes.normal, color: CINZA });
      if (esquerda) {
        const texto = this.linhas(esquerda, this.fontes.normal, TAMANHO.pequeno, LARGURA_UTIL - largura - 20)[0] ?? "";
        pagina.drawText(texto, { x: MARGEM, y, size: TAMANHO.pequeno, font: this.fontes.normal, color: CINZA });
      }
    });
  }
}

/** PDF A4 novo, com as fontes padrão (Helvetica) e a primeira página aberta. */
export async function criarEscritor(meta: { titulo: string; assunto: string }): Promise<EscritorPdf> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(meta.titulo);
  pdf.setSubject(meta.assunto);
  pdf.setCreator("Agente BNCC");
  pdf.setLanguage("pt-BR");
  const fontes: Fontes = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrito: await pdf.embedFont(StandardFonts.HelveticaBold),
    italico: await pdf.embedFont(StandardFonts.HelveticaOblique),
  };
  return new EscritorPdf(pdf, fontes);
}

/** Bytes de uma data URL ("data:image/png;base64,…"). */
export function bytesDaDataUrl(dataUrl: string): { tipo: string; bytes: Uint8Array } | null {
  const match = /^data:([a-z/+.-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) return null;
  const binario = atob(match[2]!);
  return { tipo: match[1]!.toLowerCase(), bytes: Uint8Array.from(binario, (caractere) => caractere.charCodeAt(0)) };
}
