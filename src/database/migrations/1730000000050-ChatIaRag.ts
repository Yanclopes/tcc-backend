import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Chat com IA — assistente de analise com RAG. Ver tcc-docs/specs/06-chat-ia.md.
 *
 * Cria a extensao pgvector e as quatro tabelas do modulo:
 *   - chat_documento / chat_trecho  -> base de conhecimento indexada
 *   - chat_conversa  / chat_mensagem -> historico das conversas
 *
 * ATENCAO: exige uma imagem de Postgres com a extensao 'vector' disponivel
 * (pgvector/pgvector:pg16). A postgres:16-alpine NAO a possui.
 */
export class ChatIaRag1730000000050 implements MigrationInterface {
  name = 'ChatIaRag1730000000050';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // -----------------------------------------------------------------
    // Base de conhecimento
    // -----------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "chat_documento" (
        "id"          SERIAL PRIMARY KEY,
        "fonte"       varchar(120) NOT NULL,
        "titulo"      varchar(200) NOT NULL,
        "hash"        varchar(64)  NOT NULL,
        "indexado_em" timestamp    NOT NULL DEFAULT now()
      )
    `);
    // A fonte identifica o documento de forma estavel ('curado:metricas',
    // 'banco:question:12'). E por ela que a reindexacao decide se ja existe.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_chat_documento_fonte" ON "chat_documento" ("fonte")`,
    );

    await queryRunner.query(`
      CREATE TABLE "chat_trecho" (
        "id"        SERIAL PRIMARY KEY,
        "documento" int    NOT NULL REFERENCES "chat_documento"("id") ON DELETE CASCADE,
        "ordem"     int    NOT NULL,
        "texto"     text   NOT NULL,
        "embedding" vector(1536) NOT NULL,
        "tokens"    int    NOT NULL DEFAULT 0
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_chat_trecho_documento" ON "chat_trecho" ("documento")`,
    );
    // HNSW com distancia de cosseno: e o que o retriever usa (operador <=>).
    // Melhor recall/latencia que ivfflat e nao exige treinar com dados previos.
    await queryRunner.query(`
      CREATE INDEX "idx_chat_trecho_embedding"
        ON "chat_trecho" USING hnsw ("embedding" vector_cosine_ops)
    `);

    // -----------------------------------------------------------------
    // Conversas
    // -----------------------------------------------------------------
    await queryRunner.query(`
      CREATE TABLE "chat_conversa" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "usuario"       int  NOT NULL REFERENCES "app_user"("id") ON DELETE CASCADE,
        "titulo"        varchar(200) NOT NULL,
        "criada_em"     timestamp NOT NULL DEFAULT now(),
        "atualizada_em" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_chat_conversa_usuario" ON "chat_conversa" ("usuario")`,
    );

    await queryRunner.query(`
      CREATE TABLE "chat_mensagem" (
        "id"            SERIAL PRIMARY KEY,
        "conversa"      uuid NOT NULL REFERENCES "chat_conversa"("id") ON DELETE CASCADE,
        "papel"         varchar(20) NOT NULL,
        "conteudo"      text NOT NULL,
        "passos"        jsonb NULL,
        "tokens_prompt" int NOT NULL DEFAULT 0,
        "tokens_saida"  int NOT NULL DEFAULT 0,
        "criada_em"     timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_chat_mensagem_conversa" ON "chat_mensagem" ("conversa")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_mensagem"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_conversa"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_trecho"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "chat_documento"`);
    // A extensao NAO e removida: outros objetos podem depender dela, e
    // remove-la e uma operacao destrutiva desproporcional a um rollback.
  }
}
