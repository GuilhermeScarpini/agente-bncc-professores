import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GEMINI_EMBEDDING_DIMENSIONS, GeminiError, createGeminiClient } from "./gemini";

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function fakeClient(...handlers: Handler[]) {
  const calls: Array<{ url: string; body: unknown }> = [];
  const sleeps: number[] = [];
  const client = createGeminiClient({
    apiKey: "test-key",
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)) });
      const handler = handlers[Math.min(calls.length - 1, handlers.length - 1)]!;
      return handler(url, init);
    }) as typeof fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { client, calls, sleeps };
}

const ok = (body: unknown) => () => Response.json(body);
const apiError = (status: number, body: unknown) => () => Response.json(body, { status });
const vector = (seed: number) => Array.from({ length: GEMINI_EMBEDDING_DIMENSIONS }, (_, i) => (i === seed ? 2 : 0));

function planResponse(text: string, finishReason = "STOP") {
  return ok({ candidates: [{ finishReason, content: { parts: [{ text, thought: false }] } }] });
}

describe("embed", () => {
  it("usa o formato do batchEmbedContents e normaliza os vetores", async () => {
    const { client, calls } = fakeClient(ok({ embeddings: [{ values: vector(0) }, { values: vector(1) }] }));
    const [a, b] = await client.embed(["um", "dois"]);
    assert.equal(a![0], 1);
    assert.equal(b![1], 1);
    assert.ok(calls[0]!.url.endsWith("/models/gemini-embedding-2:batchEmbedContents"));
    assert.deepEqual((calls[0]!.body as { requests: unknown[] }).requests[0], {
      model: "models/gemini-embedding-2",
      content: { parts: [{ text: "um" }] },
      outputDimensionality: 768,
    });
  });

  it("rejeita dimensões inesperadas", async () => {
    const { client } = fakeClient(ok({ embeddings: [{ values: [1, 2, 3] }] }));
    await assert.rejects(client.embed(["x"]), (error: GeminiError) => error.kind === "invalid_response");
  });
});

describe("tratamento de erros", () => {
  it("tenta de novo em 503 e depois funciona", async () => {
    const { client, calls, sleeps } = fakeClient(
      apiError(503, { error: { message: "overloaded" } }),
      ok({ embeddings: [{ values: vector(0) }] }),
    );
    await client.embed(["x"]);
    assert.equal(calls.length, 2);
    assert.equal(sleeps.length, 1);
  });

  it("respeita o retryDelay curto do Google em 429", async () => {
    const { client, sleeps } = fakeClient(
      apiError(429, {
        error: { message: "quota", details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "2s" }] },
      }),
      ok({ embeddings: [{ values: vector(0) }] }),
    );
    await client.embed(["x"]);
    assert.deepEqual(sleeps, [2000]);
  });

  it("desiste na hora quando a espera pedida é longa (cota diária)", async () => {
    const { client, calls } = fakeClient(
      apiError(429, {
        error: { message: "quota", details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "3600s" }] },
      }),
    );
    await assert.rejects(client.embed(["x"]), (error: GeminiError) => {
      assert.equal(error.kind, "rate_limit");
      assert.equal(error.retryAfterMs, 3_600_000);
      return true;
    });
    assert.equal(calls.length, 1);
  });

  it("classifica chave inválida e modelo inexistente como configuração", async () => {
    const invalidKey = fakeClient(
      apiError(400, { error: { message: "API key not valid.", details: [{ reason: "API_KEY_INVALID" }] } }),
    );
    await assert.rejects(invalidKey.client.embed(["x"]), (error: GeminiError) => error.kind === "config");
    const notFound = fakeClient(apiError(404, { error: { message: "not found" } }));
    await assert.rejects(notFound.client.embed(["x"]), (error: GeminiError) => error.kind === "config");
  });

  it("sem chave falha antes de chamar a API", async () => {
    const previous = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      let called = false;
      const client = createGeminiClient({ fetch: (async () => ((called = true), Response.json({}))) as typeof fetch });
      await assert.rejects(client.embed(["x"]), (error: GeminiError) => error.kind === "config");
      assert.equal(called, false);
    } finally {
      if (previous !== undefined) process.env.GEMINI_API_KEY = previous;
    }
  });

  it("timeout vira erro de timeout, sem nova tentativa", async () => {
    const { client, calls } = fakeClient(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    await assert.rejects(client.embed(["x"], { timeoutMs: 20 }), (error: GeminiError) => error.kind === "timeout");
    assert.equal(calls.length, 1);
  });

  it("cancelamento externo vira aborted", async () => {
    const controller = new AbortController();
    const { client } = fakeClient(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          controller.abort();
        }),
    );
    await assert.rejects(
      client.embed(["x"], { signal: controller.signal }),
      (error: GeminiError) => error.kind === "aborted",
    );
  });
});

describe("generateJson", () => {
  const params = { model: "gemini-2.5-flash", systemInstruction: "sys", prompt: "oi", schema: { type: "object" } };

  it("envia o schema e interpreta o JSON, ignorando partes de raciocínio", async () => {
    const { client, calls } = fakeClient(
      ok({
        candidates: [
          { finishReason: "STOP", content: { parts: [{ text: "pensando...", thought: true }, { text: '{"a":1}' }] } },
        ],
      }),
    );
    assert.deepEqual(await client.generateJson(params), { a: 1 });
    const body = calls[0]!.body as { generationConfig: Record<string, unknown>; systemInstruction: unknown };
    assert.ok(calls[0]!.url.endsWith("/models/gemini-2.5-flash:generateContent"));
    assert.equal(body.generationConfig.responseMimeType, "application/json");
    assert.deepEqual(body.generationConfig.responseJsonSchema, { type: "object" });
    assert.deepEqual(body.systemInstruction, { parts: [{ text: "sys" }] });
  });

  it("trata bloqueios, cortes e JSON inválido", async () => {
    const cases: Array<[Handler, string]> = [
      [ok({ promptFeedback: { blockReason: "SAFETY" } }), "blocked"],
      [planResponse("{}", "SAFETY"), "blocked"],
      [planResponse('{"a":', "MAX_TOKENS"), "invalid_response"],
      [planResponse("não é json"), "invalid_response"],
      [planResponse(""), "invalid_response"],
    ];
    for (const [handler, kind] of cases) {
      const { client } = fakeClient(handler);
      await assert.rejects(client.generateJson(params), (error: GeminiError) => error.kind === kind, kind);
    }
  });
});
