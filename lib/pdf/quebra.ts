// Quebra de linha dos PDFs (o pdf-lib desenha uma linha por vez). Sem dependências: testável.
// Mesma regra do turma-social (lib/exams/print/wrap.ts).

/** Quebra o texto em linhas que cabem na largura (palavras longas demais são cortadas). */
export function quebrarTexto(texto: string, medir: (valor: string) => number, larguraMaxima: number): string[] {
  const linhas: string[] = [];
  for (const paragrafo of texto.split(/\r?\n/)) {
    const palavras = paragrafo.split(/ +/).filter((palavra) => palavra !== "");
    if (palavras.length === 0) {
      linhas.push("");
      continue;
    }
    let linha = "";
    for (let palavra of palavras) {
      const candidata = linha ? `${linha} ${palavra}` : palavra;
      if (medir(candidata) <= larguraMaxima) {
        linha = candidata;
        continue;
      }
      if (linha) linhas.push(linha);
      // Palavra maior que a linha inteira: corta em pedaços.
      while (medir(palavra) > larguraMaxima && palavra.length > 1) {
        let corte = palavra.length - 1;
        while (corte > 1 && medir(palavra.slice(0, corte)) > larguraMaxima) corte -= 1;
        linhas.push(palavra.slice(0, corte));
        palavra = palavra.slice(corte);
      }
      linha = palavra;
    }
    linhas.push(linha);
  }
  return linhas;
}

/** Nome de arquivo a partir do título: "Prova de Frações!" → "prova-de-fracoes". */
export function nomeDeArquivo(prefixo: string, titulo: string): string {
  const slug = titulo
    .replace(/º/g, "o")
    .replace(/ª/g, "a")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/, "");
  return `${slug ? `${prefixo}-${slug}` : prefixo}.pdf`;
}
