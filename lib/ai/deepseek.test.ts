import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { createDeepSeekClient } from "./deepseek";
import { LlmError } from "./llm-error";
import { getDefaultModel, getDefaultProvider, resolveLlm } from "./llm";

type Handler = (url: string, init: RequestInit) => Response | Promise<Response>;

function fakeClient(...handlers: Handler[]) {
  const calls: Array<{ url: string; body: Record<string, unknown>; auth: string | null }> = [];
  const sleeps: number[] = [];
  const client = createDeepSeekClient({
    apiKey: "test-key",
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, body: JSON.parse(String(init.body)), auth: new Headers(init.headers).get("authorization") });
      const handler = handlers[Math.min(calls.length - 1, handlers.length - 1)]!;
      return handler(url, init);
    }) as typeof fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
    },
  });
  return { client, calls, sleeps };
}

const answer = (content: string, finishReason = "stop") => () =>
  Response.json({ choices: [{ finish_reason: finishReason, message: { role: "assistant", content } }] });
const apiError = (status: number, message: string, headers?: HeadersInit) => () =>
  Response.json({ error: { message } }, { status, headers });

const params = { model: "deepseek-flash", systemInstruction: "Gere uma prova.", prompt: "Habilidade EF03MA07", schema: { type: "object" } };

describe("DeepSeek: generateJson", () => {
  it("usa o chat no modo JSON, com o schema nas instruções e raciocínio baixo", async () => {
    const { client, calls } = fakeClient(answer('{"questoes": []}'));
    assert.deepEqual(await client.generateJson(params), { questoes: [] });
    const { url, body, auth } = calls[0]!;
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    assert.equal(auth, "Bearer test-key");
    assert.equal(body.model, "deepseek-flash");
    assert.deepEqual(body.response_format, { type: "json_object" });
    assert.equal(body.reasoning_effort, "low");
    const [system, user] = body.messages as Array<{ role: string; content: string }>;
    assert.match(system!.content, /^Gere uma prova\./);
    assert.match(system!.content, /JSON Schema:\n\{"type":"object"\}$/);
    assert.equal(user!.content, "Habilidade EF03MA07");
  });

  it("saldo esgotado vira no_credit (sem tentar de novo)", async () => {
    const { client, calls } = fakeClient(apiError(402, "Insufficient Balance"));
    await assert.rejects(client.generateJson(params), (error: unknown) => error instanceof LlmError && error.kind === "no_credit");
    assert.equal(calls.length, 1);
  });

  it("excesso de pedidos: espera o Retry-After e tenta de novo", async () => {
    const { client, calls, sleeps } = fakeClient(apiError(429, "Rate limit", { "retry-after": "2" }), answer('{"ok": true}'));
    assert.deepEqual(await client.generateJson(params), { ok: true });
    assert.equal(calls.length, 2);
    assert.deepEqual(sleeps, [2000]);
  });

  it("chave inválida e modelo inexistente são erros de configuração", async () => {
    for (const [status, message] of [
      [401, "Authentication Fails"],
      [400, "Model Not Exist"],
    ] as const) {
      const { client } = fakeClient(apiError(status, message));
      await assert.rejects(client.generateJson(params), (error: unknown) => error instanceof LlmError && error.kind === "config");
    }
  });

  it("resposta cortada ou que não é JSON vira invalid_response", async () => {
    for (const handler of [answer('{"questoes": [', "length"), answer("isto não é JSON")]) {
      const { client } = fakeClient(handler);
      await assert.rejects(client.generateJson(params), (error: unknown) => error instanceof LlmError && error.kind === "invalid_response");
    }
  });
});

describe("escolha da IA", () => {
  const original = { provider: process.env.LLM_PROVIDER, model: process.env.DEEPSEEK_MODEL };
  afterEach(() => {
    if (original.provider === undefined) delete process.env.LLM_PROVIDER;
    else process.env.LLM_PROVIDER = original.provider;
    if (original.model === undefined) delete process.env.DEEPSEEK_MODEL;
    else process.env.DEEPSEEK_MODEL = original.model;
  });

  it("sem LLM_PROVIDER vale o Gemini; com ele, a IA escolhida", () => {
    delete process.env.LLM_PROVIDER;
    assert.equal(getDefaultProvider(), "gemini");
    process.env.LLM_PROVIDER = "DeepSeek";
    assert.equal(getDefaultProvider(), "deepseek");
    process.env.LLM_PROVIDER = "outra";
    assert.equal(getDefaultProvider(), "gemini");
  });

  it("o pedido escolhe a IA e o modelo; sem modelo, vale o padrão da IA", () => {
    delete process.env.LLM_PROVIDER;
    delete process.env.DEEPSEEK_MODEL;
    assert.deepEqual(resolveLlm({ llm: "deepseek" }), { provider: "deepseek", model: "deepseek-flash" });
    assert.deepEqual(resolveLlm({ llm: "deepseek", modelo: "deepseek-v4-pro" }), { provider: "deepseek", model: "deepseek-v4-pro" });
    assert.equal(resolveLlm().provider, "gemini");
    process.env.DEEPSEEK_MODEL = "deepseek-v4-pro";
    assert.equal(getDefaultModel("deepseek"), "deepseek-v4-pro");
  });
});
