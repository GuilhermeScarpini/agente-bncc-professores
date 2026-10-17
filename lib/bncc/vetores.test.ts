import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bytesToVector, cosineSimilarity, normalize, topKBySimilarity, vectorToBytes } from "./vetores";

describe("vetores", () => {
  it("normaliza para norma 1", () => {
    const vector = normalize([3, 4]);
    assert.ok(Math.abs(vector[0]! - 0.6) < 1e-6 && Math.abs(vector[1]! - 0.8) < 1e-6);
    assert.throws(() => normalize([0, 0]));
  });

  it("serializa e lê de volta, mesmo com buffer desalinhado", () => {
    const vector = normalize([1, 2, 3, 4]);
    const bytes = vectorToBytes(vector);
    assert.equal(bytes.byteLength, 16);
    assert.deepEqual(bytesToVector(bytes), vector);

    // Simula um Buffer do driver com byteOffset que não é múltiplo de 4.
    const padded = new Uint8Array(bytes.byteLength + 1);
    padded.set(bytes, 1);
    assert.deepEqual(bytesToVector(padded.subarray(1)), vector);
    assert.throws(() => bytesToVector(new Uint8Array(3)));
  });

  it("ordena pelo cosseno e respeita k", () => {
    const query = normalize([1, 0]);
    const items = [
      { id: "ortogonal", v: normalize([0, 1]) },
      { id: "igual", v: normalize([2, 0]) },
      { id: "parecido", v: normalize([1, 1]) },
    ];
    const ranked = topKBySimilarity(query, items, (item) => item.v, 2);
    assert.deepEqual(
      ranked.map((entry) => entry.item.id),
      ["igual", "parecido"],
    );
    assert.ok(Math.abs(ranked[0]!.similarity - 1) < 1e-6);
    assert.throws(() => cosineSimilarity(normalize([1, 0]), normalize([1, 0, 0])));
  });
});
