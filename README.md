# Desafio ODS — Backend

Backend da plataforma web gamificada para **levantamento do conhecimento sobre os Objetivos de
Desenvolvimento Sustentável (ODS)**. O jogo, no formato de game show de perguntas e respostas, apresenta perguntas
de múltipla escolha (4 alternativas) associadas a um ou mais ODS, com níveis de dificuldade e
**power-ups** (ajudas). Cada resposta é registrada como dado bruto para a pesquisa.

> Trabalho de Conclusão de Curso — Sistemas de Informação / UNIDAVI.

## Stack

Alinhada ao referencial teórico do TCC:

| Camada | Tecnologia |
| --- | --- |
| Framework | **NestJS** (TypeScript, arquitetura modular) |
| ORM | **TypeORM** + migrations |
| Banco relacional | **PostgreSQL 16** |
| Estado de jogo em tempo real | **Redis** |
| Tempo real | **WebSocket** (Socket.IO) |
| Documentação | **Swagger / OpenAPI** |
| Autenticação | **JWT** (RFC 7519) + bcrypt |
| Containerização | **Docker** + Docker Compose |
| Testes | **Jest** (unitários) + Supertest (e2e) |

## Arquitetura

Organização por módulos de domínio (`src/modules`):

- **auth** — registro (com consentimento LGPD), login, JWT, guardas (inclui guarda opcional
  que permite partidas anônimas).
- **users** — usuários (`app_user`), perfis (`role`) e escolaridade.
- **geo** — hierarquia geográfica (país → estado → cidade → escola) para o recorte regional.
- **goals** — os 17 ODS.
- **questions** — perguntas e opções; seleção para o jogo sem revelar a resposta.
- **powerups** — catálogo de ajudas.
- **game** — motor do jogo: REST (`GameController`) + WebSocket (`GameGateway`), pontuação
  (`game-scoring.ts`) e estado efêmero no Redis (`GameSessionService`).
- **ranking** — placar de pontuação.
- **analytics** — leitura das *materialized views* e refresh.
- **health** — verificação de saúde (Postgres + Redis).

A **fonte da verdade** é o PostgreSQL (respostas, pontuação final, ranking). O **Redis** guarda o
estado volátil da partida em andamento, para leitura/escrita de baixa latência.

## Modelo de dados

O schema foi portado do modelo concebido no dbdiagram para migrations do TypeORM:

- `src/database/migrations/1730000000000-InitialSchema.ts` — todas as tabelas, FKs e índices.
- `src/database/migrations/1730000000001-MaterializedViews.ts` — as 3 *materialized views*
  analíticas (`mv_acerto_por_ods`, `mv_desempenho_por_escolaridade`, `mv_calibragem_perguntas`),
  cada uma com índice único (necessário para `REFRESH ... CONCURRENTLY`).

## Como executar

### Opção A — Tudo em containers

```bash
cp .env.example .env            # ajuste os segredos (JWT_SECRET etc.)
docker compose up -d --build    # sobe api + postgres + redis
docker compose exec api npm run migration:run
docker compose exec api npm run seed
```

API em `http://localhost:3000/api/v1` · Swagger em `http://localhost:3000/api/v1/docs`.

### Opção B — Infra em container, API local (desenvolvimento)

```bash
cp .env.example .env
docker compose up -d postgres redis
npm install
npm run migration:run
npm run seed
npm run start:dev
```

## Estrutura do estado de jogo no Redis

Cada partida tem uma chave `game:{gameId}` contendo um JSON (`GameSessionState`), com TTL
configurável (`GAME_SESSION_TTL`, padrão 2h):

```jsonc
{
  "gameId": "uuid",
  "userId": 1,                 // null em partida anônima
  "difficultyId": "classic",
  "educationLevelId": 3,
  "numberQuestions": 15,       // null = modo infinito
  "score": 350,
  "streak": 3,
  "answered": 4,
  "servedQuestionIds": [10, 22, 5, 31],
  "currentQuestion": {         // pergunta em aberto (ou null)
    "questionId": 31,
    "difficulty": 2,
    "startedAt": 1730000000000,
    "removedOptionIds": [],    // preenchido pelo power-up 50:50
    "powerupUsed": null
  },
  "powerups": { "fifty": true, "skip": false, "audience": true },
  "status": "in_progress"
}
```

O TTL é renovado a cada ação, mantendo a sessão viva enquanto se joga. Ao finalizar, a chave é
removida e os dados consolidados ficam no PostgreSQL.

## Fluxo de uma partida (REST)

1. `POST /games` — inicia (anônima ou autenticada). Retorna `gameId` e estado inicial.
2. `GET /games/:id/next` — próxima pergunta (sem a resposta correta).
3. `POST /games/:id/answers` — envia a resposta; retorna acerto, opção correta e pontos.
4. `POST /games/:id/powerups` — usa `fifty`, `skip` ou `audience`.
5. `POST /games/:id/finish` — finaliza e grava o ranking.

## Eventos WebSocket

Namespace `/game` (Socket.IO). Cada partida usa uma *room* `game:{gameId}`.

| Cliente → Servidor | Payload | Servidor → Cliente |
| --- | --- | --- |
| `game:start` | `{ difficultyId, educationLevelId? }` | `game:started` |
| `game:next` | `{ gameId }` | `game:question` |
| `game:answer` | `{ gameId, optionId, responseTimeMs? }` | `game:answer:result` |
| `game:powerup` | `{ gameId, powerup }` | `game:powerup:result` |
| `game:finish` | `{ gameId }` | `game:finished` |

Erros de domínio são propagados como `WsException`.

## Pontuação (gamificação)

`computeScore` (`src/modules/game/game-scoring.ts`): pontos = base × dificuldade + bônus de
velocidade + bônus de *streak*, com penalidade quando se usa ajuda. Errar zera a *streak* e não
pontua. Função pura e coberta por testes.

## Testes

```bash
npm test          # unitários (não exigem infraestrutura)
npm run test:cov  # com cobertura
npm run test:e2e  # ponta-a-ponta (exige postgres + redis + migração + seed)
```

## Migrations

```bash
npm run migration:run                       # aplica as migrations
npm run migration:revert                    # desfaz a última
npm run migration:generate src/database/migrations/NomeDaMigration
```

## Variáveis de ambiente

Ver `.env.example`. Destaques: conexão Postgres/Redis, `JWT_SECRET`, `GAME_SESSION_TTL` e
`GAME_DEFAULT_POWERUPS`. **Nunca** versione o `.env` (já está no `.gitignore`).
