import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { DURACAO_SESSAO_MS, conferirSenha, criarTokenSessao, destinoSeguro, modoDeAcesso, tokenSessaoValido } from "./sessao";

const env = process.env as Record<string, string | undefined>;
const anterior = { senha: env.ACESSO_SENHA, chave: env.AGENTE_BNCC_API_KEY, nodeEnv: env.NODE_ENV };

function restaurar(nome: string, valor: string | undefined) {
  if (valor === undefined) delete env[nome];
  else env[nome] = valor;
}

describe("sessão por senha", () => {
  beforeEach(() => {
    env.ACESSO_SENHA = "girassol-2026";
    env.AGENTE_BNCC_API_KEY = "chave-de-teste";
  });
  afterEach(() => {
    restaurar("ACESSO_SENHA", anterior.senha);
    restaurar("AGENTE_BNCC_API_KEY", anterior.chave);
    restaurar("NODE_ENV", anterior.nodeEnv);
  });

  it("confere a senha (ignorando espaços nas pontas)", () => {
    assert.equal(conferirSenha(" girassol-2026 "), true);
    assert.equal(conferirSenha("girassol"), false);
    assert.equal(conferirSenha(""), false);
  });

  it("o token vale por 30 dias e depois expira", () => {
    const agora = Date.UTC(2026, 9, 18);
    const token = criarTokenSessao(agora);
    assert.equal(tokenSessaoValido(token, agora + 1000), true);
    assert.equal(tokenSessaoValido(token, agora + DURACAO_SESSAO_MS + 1), false);
  });

  it("recusa token adulterado, vazio ou de outra senha", () => {
    const agora = Date.now();
    const token = criarTokenSessao(agora);
    const [expira, assinatura] = token.split(".");
    assert.equal(tokenSessaoValido(`${Number(expira) + 999_999}.${assinatura}`, agora), false);
    assert.equal(tokenSessaoValido(`${expira}.x${assinatura}`, agora), false);
    assert.equal(tokenSessaoValido(undefined, agora), false);
    assert.equal(tokenSessaoValido("lixo", agora), false);
    env.ACESSO_SENHA = "nova-senha";
    assert.equal(tokenSessaoValido(token, agora), false);
  });

  it("sem senha: aberto em desenvolvimento, bloqueado em produção, e nenhum token vale", () => {
    const token = criarTokenSessao();
    assert.equal(modoDeAcesso(), "senha");
    delete env.ACESSO_SENHA;
    env.NODE_ENV = "development";
    assert.equal(modoDeAcesso(), "aberto");
    env.NODE_ENV = "production";
    assert.equal(modoDeAcesso(), "bloqueado");
    assert.equal(tokenSessaoValido(token), false);
    assert.equal(conferirSenha(""), false);
  });

  it("depois do login, só volta para caminhos deste site", () => {
    assert.equal(destinoSeguro("/provas"), "/provas");
    assert.equal(destinoSeguro("//site-malicioso.com"), "/");
    assert.equal(destinoSeguro("/\\site-malicioso.com"), "/");
    assert.equal(destinoSeguro("https://site-malicioso.com"), "/");
    assert.equal(destinoSeguro(undefined), "/");
  });
});
