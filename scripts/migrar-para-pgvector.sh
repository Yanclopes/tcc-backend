#!/usr/bin/env bash
#
# Migra o volume do Postgres de postgres:16-alpine para pgvector/pgvector:pg16.
#
# POR QUE NAO BASTA TROCAR A IMAGEM
#
# A imagem antiga e Alpine (musl); a do pgvector e Debian (glibc), e o pgvector
# nao publica variante Alpine. As duas libcs ordenam texto de forma diferente:
# musl e praticamente ordem de byte, glibc ignora caixa e pontuacao no nivel
# primario. Indices btree sobre texto sao construidos NA ORDEM DA COLLATION.
#
# Subir a imagem nova sobre o volume antigo deixa esses indices inconsistentes
# — e NAO da erro. Simplesmente deixa de encontrar linhas que existem. No schema
# atual sao 7 indices nessa condicao, dois deles criticos: app_user_email_key
# (UNIQUE em e-mail, com login dependendo dele) e game_pkey.
#
# Este script faz dump, descarta o volume antigo e restaura num volume novo, o
# que reconstroi todos os indices sob a collation nova.
#
# USO
#   ./scripts/migrar-para-pgvector.sh                      # producao (padrao)
#   COMPOSE=docker-compose.yml ./scripts/migrar-para-pgvector.sh   # dev
#
# O script e conservador de proposito: confirma antes de destruir, verifica o
# dump antes de apagar qualquer coisa e confere a contagem de tabelas no fim.
# Nao ha o que ganhar em ser rapido aqui.

set -euo pipefail

COMPOSE="${COMPOSE:-docker-compose.prod.yml}"
SERVICO_DB="${SERVICO_DB:-postgres}"
DB_USER="${DB_USERNAME:-ods}"
DB_NAME="${DB_DATABASE:-ods_quiz}"
IMAGEM_NOVA="pgvector/pgvector:pg16"

# HOME nao existe quando o script roda por SSM ou cron, e `set -u` transforma
# isso em erro fatal. O fallback mantem o script utilizavel nos dois contextos.
DESTINO="${HOME:-/home/ubuntu}"
[ -d "$DESTINO" ] || DESTINO=/tmp
BACKUP="${BACKUP:-$DESTINO/pre-pgvector-$(date +%Y%m%dT%H%M%S).sql}"

erro() { echo "ERRO: $*" >&2; exit 1; }
passo() { echo; echo "==> $*"; }

command -v docker >/dev/null || erro "docker nao encontrado."
[ -f "$COMPOSE" ] || erro "arquivo '$COMPOSE' nao encontrado. Rode a partir da raiz do tcc-backend."

# O nome do volume segue o padrao do compose: <projeto>_postgres_data. Nomear
# explicitamente evita 'down -v', que apagaria volumes de outros servicos.
PROJETO="$(basename "$(pwd)")"
VOLUME="${VOLUME:-${PROJETO}_postgres_data}"

passo "Conferindo o estado atual"
# `< /dev/null` em todo exec que nao le stdin: sem isso eles consomem a
# entrada padrao e a confirmacao abaixo e engolida — um script destrutivo nao
# pode pular a propria pergunta.
docker compose -f "$COMPOSE" exec -T "$SERVICO_DB" \
  psql -U "$DB_USER" -d "$DB_NAME" -tc "select version();" < /dev/null \
  || erro "banco inacessivel."
docker volume inspect "$VOLUME" >/dev/null 2>&1 || erro "volume '$VOLUME' nao existe. Defina VOLUME=."

echo
echo "  compose : $COMPOSE"
echo "  volume  : $VOLUME  (SERA APAGADO)"
echo "  backup  : $BACKUP"
echo
read -rp "Isto derruba o banco e recria o volume. Continuar? [digite SIM] " resposta
[ "$resposta" = "SIM" ] || erro "cancelado pelo usuario."

passo "1/5 — Dump"
docker compose -f "$COMPOSE" exec -T "$SERVICO_DB" \
  pg_dump -U "$DB_USER" --no-owner --no-acl "$DB_NAME" < /dev/null > "$BACKUP"

TABELAS=$(grep -c '^CREATE TABLE' "$BACKUP" || true)
COPIES=$(grep -c '^COPY ' "$BACKUP" || true)
echo "    tabelas no dump: $TABELAS | blocos de dados: $COPIES | $(du -h "$BACKUP" | cut -f1)"
[ "$TABELAS" -gt 0 ] || erro "dump sem nenhuma tabela — abortando ANTES de apagar o volume."

passo "2/5 — Derrubando os containers"
docker compose -f "$COMPOSE" down

passo "3/5 — Removendo o volume antigo"
docker volume rm "$VOLUME"

passo "4/5 — Subindo $IMAGEM_NOVA com volume limpo"
docker compose -f "$COMPOSE" up -d "$SERVICO_DB"
for _ in $(seq 1 30); do
  if docker compose -f "$COMPOSE" exec -T "$SERVICO_DB" \
       pg_isready -U "$DB_USER" -d "$DB_NAME" </dev/null >/dev/null 2>&1; then break; fi
  sleep 2
done
docker compose -f "$COMPOSE" exec -T "$SERVICO_DB" \
  pg_isready -U "$DB_USER" -d "$DB_NAME" </dev/null >/dev/null 2>&1 \
  || erro "Postgres nao respondeu a tempo."

passo "5/5 — Restaurando"
docker compose -f "$COMPOSE" exec -T "$SERVICO_DB" \
  psql -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -q < "$BACKUP"

passo "Verificacao"
docker compose -f "$COMPOSE" exec -T "$SERVICO_DB" psql -U "$DB_USER" -d "$DB_NAME" \
  -c "select version();" \
  -c "select count(*) as tabelas from information_schema.tables
       where table_schema='public' and table_type='BASE TABLE';" \
  -c "select count(*) as materialized_views from pg_matviews;" < /dev/null

RESTAURADAS=$(docker compose -f "$COMPOSE" exec -T "$SERVICO_DB" psql -U "$DB_USER" -d "$DB_NAME" -tAc \
  "select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE';" \
  < /dev/null | tr -d '[:space:]')
echo "    tabelas restauradas: $RESTAURADAS (dump tinha $TABELAS)"
[ "$RESTAURADAS" -eq "$TABELAS" ] || erro "contagem divergente. O dump esta em $BACKUP — nao foi perdido."

# uuid-ossp: instalada a mao em producao em algum momento e ausente do dump.
# Nada depende dela hoje, mas manter dev e prod iguais evita surpresa.
docker compose -f "$COMPOSE" exec -T "$SERVICO_DB" \
  psql -U "$DB_USER" -d "$DB_NAME" -q -c 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";' < /dev/null

passo "Concluido"
cat <<FIM

  Backup preservado em: $BACKUP
  (apague so depois de confirmar que a aplicacao esta saudavel)

  Proximos passos:
    docker compose -f $COMPOSE up -d
    docker compose -f $COMPOSE exec -T api npm run migration:run:prod
    docker compose -f $COMPOSE exec -T api npm run chat:indexar:prod

  A indexacao exige OPENAI_API_KEY no .env do servidor. Sem ela, o modulo de
  chat sobe desabilitado (rotas /chat respondem 503) e o resto segue normal.
FIM
