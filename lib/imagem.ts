// Imagens das questões: lidas e reduzidas no navegador. Não vão ao servidor (o agente não
// guarda arquivos); ficam na página até o professor gerar outra prova ou recarregar.

/** 1200 px no lado maior bastam para a tela e para a folha impressa. */
const LADO_MAXIMO = 1200;
const TAMANHO_MAXIMO = 15 * 1024 * 1024;

export class ImagemInvalidaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImagemInvalidaError";
  }
}

export interface ImagemPreparada {
  /** data:image/png ou data:image/jpeg. */
  src: string;
  largura: number;
  altura: number;
}

/** Abre a imagem escolhida e a reduz. PNG continua PNG (desenhos e tabelas ficam nítidos); o resto vira JPEG. */
export async function prepararImagem(arquivo: File): Promise<ImagemPreparada> {
  if (!arquivo.type.startsWith("image/")) {
    throw new ImagemInvalidaError("Escolha um arquivo de imagem (JPG, PNG, WebP ou GIF).");
  }
  if (arquivo.size > TAMANHO_MAXIMO) throw new ImagemInvalidaError("A imagem pode ter no máximo 15 MB.");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(arquivo);
  } catch {
    throw new ImagemInvalidaError("Não foi possível abrir esta imagem. Tente outra, em JPG ou PNG.");
  }

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.max(1, Math.round(bitmap.width * escala));
  const altura = Math.max(1, Math.round(bitmap.height * escala));
  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const contexto = canvas.getContext("2d");
  if (!contexto) {
    bitmap.close();
    throw new ImagemInvalidaError("O navegador não conseguiu preparar a imagem.");
  }

  const png = arquivo.type === "image/png";
  if (!png) {
    // JPEG não tem transparência: o fundo transparente vira branco, como na folha.
    contexto.fillStyle = "#ffffff";
    contexto.fillRect(0, 0, largura, altura);
  }
  contexto.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close();

  return { src: png ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.88), largura, altura };
}
