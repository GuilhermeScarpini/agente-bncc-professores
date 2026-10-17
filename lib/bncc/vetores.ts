// Operações vetoriais da busca semântica. A BNCC tem ~1.600 habilidades: comparar a
// pergunta com todas leva poucos milissegundos, então a busca é exata (sem índice ANN).

/** Serializa o vetor para a coluna Bytes (float32, ordem de bytes da plataforma: little-endian). */
export function vectorToBytes(vector: Float32Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Float32Array.from(vector).buffer);
}

export function bytesToVector(bytes: Uint8Array): Float32Array {
  if (bytes.byteLength % 4 !== 0) throw new Error("Embedding corrompido: tamanho não é múltiplo de 4 bytes.");
  // Copia para um ArrayBuffer próprio: buffers do driver podem ter byteOffset desalinhado.
  return new Float32Array(Uint8Array.from(bytes).buffer);
}

/** Devolve o vetor com norma 1, para que o produto escalar seja a similaridade de cosseno. */
export function normalize(values: ArrayLike<number>): Float32Array {
  const vector = Float32Array.from(values);
  let sum = 0;
  for (const value of vector) sum += value * value;
  const norm = Math.sqrt(sum);
  if (norm === 0) throw new Error("Embedding inválido: vetor nulo.");
  for (let index = 0; index < vector.length; index += 1) vector[index]! /= norm;
  return vector;
}

/** Similaridade de cosseno entre vetores já normalizados. */
export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error(`Dimensões diferentes: ${a.length} e ${b.length}.`);
  let dot = 0;
  for (let index = 0; index < a.length; index += 1) dot += a[index]! * b[index]!;
  return dot;
}

export interface Ranked<T> {
  item: T;
  similarity: number;
}

/** Os `k` itens mais parecidos com a consulta, do mais para o menos similar. */
export function topKBySimilarity<T>(
  query: Float32Array,
  items: readonly T[],
  getVector: (item: T) => Float32Array,
  k: number,
): Ranked<T>[] {
  return items
    .map((item) => ({ item, similarity: cosineSimilarity(query, getVector(item)) }))
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, k);
}
