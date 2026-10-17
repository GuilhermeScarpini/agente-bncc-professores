# Agente BNCC

Serviço que gera planos de aula ancorados nas habilidades oficiais da **BNCC** (Base Nacional Comum Curricular). O professor descreve o tema da aula e, se quiser, filtra por disciplina e ano escolar. O agente:

1. busca as habilidades da BNCC mais parecidas com o tema: filtra por disciplina e ano no banco e ordena por similaridade semântica;
2. pede ao Gemini um plano ancorado nessas habilidades, com os códigos e a justificativa, os objetivos de aprendizagem, a metodologia passo a passo e a avaliação formativa;
3. confere a resposta: só aparecem códigos que vieram da base, sempre com o texto oficial da BNCC.

Ele funciona sozinho (há uma página de demonstração em `/`) e também como API para outros sistemas, como a rede social [turma-social](https://github.com/GuilhermeScarpini/turma-social).

**Stack:** Next.js 16 (App Router), React 19 e TypeScript estrito, com Tailwind CSS 4. Os dados ficam em SQLite com Prisma 7. A IA é o Gemini: `gemini-embedding-2` para a busca e `gemini-2.5-flash` para os planos, ambos no plano gratuito.

## Como rodar

Requisitos: Node.js 20 ou mais novo, e npm.

```bash
npm install
```

1. O `npm install` cria o `.env` com uma `AGENTE_BNCC_API_KEY` aleatória.
2. Crie uma chave gratuita do Gemini em https://aistudio.google.com/apikey e coloque no `.env`: `GEMINI_API_KEY="sua-chave"`.
3. Carregue a BNCC, uma vez só:

   ```bash
   npm run db:seed-bncc
   ```

   O seed grava as 1.580 habilidades e gera os embeddings em lotes de 100. Se a cota gratuita acabar no meio, rode de novo mais tarde: o progresso fica salvo e só o que falta é enviado.

4. Suba o servidor:

   ```bash
   npm run dev
   ```

   A demonstração abre em http://localhost:3200.

## Scripts

| Comando                | O que faz                                                         |
| ---------------------- | ----------------------------------------------------------------- |
| `npm run dev`          | Prepara o `.env` e o banco e sobe o servidor na porta 3200        |
| `npm run db:seed-bncc` | Carrega a BNCC e gera os embeddings (precisa da `GEMINI_API_KEY`) |
| `npm run build`        | Build de produção                                                 |
| `npm start`            | Servidor de produção na porta 3200 (depois do build)              |
| `npm test`             | Testes                                                            |
| `npm run lint`         | ESLint                                                            |
| `npm run typecheck`    | Checagem de tipos do TypeScript                                   |
| `npm run db:studio`    | Abre o Prisma Studio para ver os dados                            |

## API (v1)

Todas as respostas seguem o formato `{ "ok": true, "data": ... }` ou `{ "ok": false, "error": "mensagem em português", "fieldErrors"?: { campo: [mensagens] } }`.

### `POST /api/v1/planos`

Gera um plano. Exige o cabeçalho `Authorization: Bearer <AGENTE_BNCC_API_KEY>`.

```bash
curl -X POST http://localhost:3200/api/v1/planos \
  -H "Authorization: Bearer $AGENTE_BNCC_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"tema": "frações equivalentes com receitas", "componente": "Matemática", "anoEscolar": "ef-6"}'
```

| Campo        | Obrigatório | Descrição                                                     |
| ------------ | ----------- | ------------------------------------------------------------- |
| `tema`       | sim         | O que trabalhar na aula (3 a 500 caracteres)                  |
| `componente` | não         | Disciplina, exatamente como em `GET /api/v1/catalogo`         |
| `anoEscolar` | não         | Valor de ano escolar de `GET /api/v1/catalogo` (ex.: `ef-6`, `em`) |

A resposta (`data`) traz:

- `titulo`, `duracao`, `objetivos`, `metodologia` (etapas com tempo) e `avaliacao` (instrumentos);
- `habilidades`: os códigos escolhidos, com o texto oficial, componente, ano e justificativa;
- `aviso`: preenchido quando as habilidades encontradas não cobrem bem o tema;
- `resumoParaFeed`: texto curto para compartilhar com a turma, sem códigos;
- `consultadas`: todas as habilidades recuperadas, com a similaridade;
- `texto`: o plano inteiro em texto simples, pronto para copiar.

| Status | Quando                                                                    |
| ------ | ------------------------------------------------------------------------- |
| 400    | Corpo inválido (veja `fieldErrors`)                                       |
| 401    | Chave de API ausente ou errada                                            |
| 415    | O corpo não foi enviado como JSON                                         |
| 422    | Nenhuma habilidade para os filtros, ou o tema não pôde ser ancorado       |
| 429    | Limite atingido: 30 planos a cada 10 minutos, ou cota do Gemini (veja `Retry-After`) |
| 502    | O Gemini devolveu uma resposta fora do formato                            |
| 503    | Agente sem `GEMINI_API_KEY`, BNCC não carregada ou Gemini fora do ar       |
| 504    | O Gemini demorou demais                                                   |

A geração leva de 10 a 30 segundos. Se o cliente cancelar a requisição, o agente também interrompe a chamada ao Gemini.

### `GET /api/v1/catalogo`

Lista as disciplinas (agrupadas por etapa) e os anos escolares aceitos nos filtros. É pública.

### `GET /api/v1/status`

Diz se o agente está pronto (`pronto`, `configurado`, `habilidades`, modelos). É pública e serve de health check.

## Como um sistema cliente se conecta

1. Rode o agente e copie a `AGENTE_BNCC_API_KEY` do `.env` dele.
2. No `.env` do cliente, guarde a URL do agente e a chave, por exemplo `AGENTE_BNCC_URL="http://localhost:3200"` e `AGENTE_BNCC_API_KEY="..."`.
3. Chame `POST /api/v1/planos` **pelo servidor do cliente**, nunca pelo navegador: a chave não pode chegar ao usuário. Aplique no cliente o limite por usuário e as permissões (no turma-social, só a professora gera planos).

## Dados e modelos

- **Habilidades:** `prisma/data/bncc-habilidades.json` tem o código e a descrição literais de todas as habilidades da BNCC homologada (93 da Educação Infantil, 1.304 do Ensino Fundamental e 183 do Ensino Médio), extraídos do PDF oficial do MEC. Etapa, ano e componente são derivados do código.
- **Outra fonte:** `npm run db:seed-bncc -- --arquivo habilidades.csv` aceita CSV (separado por `;`, `,` ou tab) ou JSON, com as colunas `id` (ou `codigo`) e `descricao`, e, opcionalmente, `unidade_tematica` e `objeto_conhecimento`. Use `-- --forcar` para recalcular todos os embeddings.
- **Busca:** os embeddings (768 dimensões) ficam na tabela `bncc_habilidades` do SQLite. A comparação com o tema é feita em memória: são cerca de 1.600 vetores, o que leva poucos milissegundos e dá um resultado exato.
- **Geração:** para trocar o modelo, defina `GEMINI_MODEL` no `.env`. O `text-embedding-004` não é usado porque o Google o desligou em janeiro de 2026.
- **Privacidade:** o tema é enviado à API do Google, e no plano gratuito o Google pode usar esse conteúdo para melhorar os produtos dele. Não envie nomes nem dados de alunos no tema.

## Estrutura

```
app/                 página de demonstração e rotas da API (api/v1, api/demo)
components/          interface da demonstração (bncc/ = formulário e plano; ui/ = campos e botões)
hooks/               chamada ao gerador com cancelamento
lib/ai/              cliente da API do Gemini (timeout, novas tentativas, erros tipados)
lib/bncc/            códigos da BNCC, busca vetorial, prompt, validação da resposta e serviço
prisma/              schema e dados da BNCC (data/)
scripts/             preparação do .env e seed da BNCC
```

## Produção

- Desligue a demonstração com `DEMO_HABILITADA="false"` se o agente ficar exposto na internet: a página não pede chave e só tem o limite por IP (5 planos a cada 10 minutos).
- Os limites de uso ficam em memória: servem para um único servidor.
- Use HTTPS entre o cliente e o agente quando eles estiverem em máquinas diferentes.

## Problemas comuns

- **`npm install` ou `npm run db:seed-bncc` falham com `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`:** a rede, geralmente de empresa, intercepta HTTPS. Rode o comando com `NODE_OPTIONS=--use-system-ca`, por exemplo `NODE_OPTIONS=--use-system-ca npm run db:seed-bncc` no Git Bash.
- **`better-sqlite3` tenta compilar e pede o Visual Studio:** a versão está fixada em `12.11.1`, que tem binário pronto para Windows.
