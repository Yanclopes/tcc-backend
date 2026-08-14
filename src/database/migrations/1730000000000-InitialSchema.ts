import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema inicial completo do "Desafio ODS": tabelas relacionais, materialized
 * views analiticas e recursos administrativos. Consolidado em um unico arquivo
 * pois o projeto ainda nao entrou em producao.
 */
export class InitialSchema1730000000000 implements MigrationInterface {
  name = 'InitialSchema1730000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ----- Localizacao -----
    await queryRunner.query(`
      CREATE TABLE "country" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "state" (
        "id" SERIAL PRIMARY KEY,
        "code" char(2) NOT NULL,
        "name" varchar NOT NULL,
        "country" integer REFERENCES "country"("id") ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_state_country" ON "state" ("country");`);

    await queryRunner.query(`
      CREATE TABLE "city" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL,
        "state" integer REFERENCES "state"("id") ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_city_state" ON "city" ("state");`);

    await queryRunner.query(`
      CREATE TABLE "school" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL,
        "city" integer REFERENCES "city"("id") ON DELETE RESTRICT
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_school_city" ON "school" ("city");`);

    // ----- Perfil e educacao -----
    await queryRunner.query(`
      CREATE TABLE "education_level" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "role" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL
      );
    `);

    // education_level e NOT NULL: escolaridade e obrigatoria no cadastro
    // (sustenta o recorte por segmento educacional na pesquisa).
    await queryRunner.query(`
      CREATE TABLE "app_user" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL,
        "email" varchar NOT NULL UNIQUE,
        "password" varchar NOT NULL,
        "school" integer REFERENCES "school"("id") ON DELETE SET NULL,
        "education_level" integer NOT NULL REFERENCES "education_level"("id") ON DELETE RESTRICT,
        "role" integer REFERENCES "role"("id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "user_consent" (
        "id" SERIAL PRIMARY KEY,
        "user" integer REFERENCES "app_user"("id") ON DELETE CASCADE,
        "consent_version" varchar NOT NULL,
        "granted_at" timestamp NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_user_consent_user" ON "user_consent" ("user");`);

    // Niveis de escolaridade atendidos por cada escola (N:N).
    await queryRunner.query(`
      CREATE TABLE "school_education_level" (
        "school" integer NOT NULL,
        "education_level" integer NOT NULL,
        CONSTRAINT "pk_school_education_level" PRIMARY KEY ("school", "education_level"),
        CONSTRAINT "fk_sel_school" FOREIGN KEY ("school") REFERENCES "school"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_sel_level" FOREIGN KEY ("education_level") REFERENCES "education_level"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_sel_level" ON "school_education_level" ("education_level");`,
    );

    // Sugestoes de escola feitas por alunos no cadastro; admin revisa e aprova.
    await queryRunner.query(`
      CREATE TABLE "school_suggestion" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL,
        "city" integer NOT NULL REFERENCES "city"("id") ON DELETE RESTRICT,
        "note" varchar,
        "suggested_by" integer REFERENCES "app_user"("id") ON DELETE SET NULL,
        "status" varchar NOT NULL DEFAULT 'pending',
        "created_school" integer REFERENCES "school"("id") ON DELETE SET NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "resolved_at" timestamp
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_suggestion_status" ON "school_suggestion" ("status");`,
    );

    // ----- ODS, perguntas e opcoes -----
    await queryRunner.query(`
      CREATE TABLE "goal" (
        "id" SERIAL PRIMARY KEY,
        "number" integer NOT NULL,
        "name" varchar NOT NULL,
        "color" varchar NOT NULL,
        CONSTRAINT "uq_goal_number" UNIQUE ("number")
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "question" (
        "id" SERIAL PRIMARY KEY,
        "text" varchar NOT NULL,
        "goal" integer NOT NULL REFERENCES "goal"("id") ON DELETE RESTRICT,
        "answer" integer,
        "education_level" integer REFERENCES "education_level"("id") ON DELETE SET NULL,
        "difficulty" integer NOT NULL DEFAULT 1,
        "source" varchar,
        "is_active" boolean NOT NULL DEFAULT true
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_question_goal" ON "question" ("goal");`);
    await queryRunner.query(`CREATE INDEX "idx_question_difficulty" ON "question" ("difficulty");`);
    await queryRunner.query(`CREATE INDEX "idx_question_active" ON "question" ("is_active");`);

    await queryRunner.query(`
      CREATE TABLE "question_option" (
        "id" SERIAL PRIMARY KEY,
        "text" varchar NOT NULL,
        "question" integer NOT NULL REFERENCES "question"("id") ON DELETE CASCADE
      );
    `);
    await queryRunner.query(
      `CREATE INDEX "idx_question_option_question" ON "question_option" ("question");`,
    );

    // answer aponta para question_option: FK adicionada depois de a tabela existir.
    await queryRunner.query(`
      ALTER TABLE "question"
        ADD CONSTRAINT "fk_question_answer"
        FOREIGN KEY ("answer") REFERENCES "question_option"("id") ON DELETE SET NULL;
    `);

    // ----- Logica do jogo -----
    await queryRunner.query(`
      CREATE TABLE "game_status" (
        "id" SERIAL PRIMARY KEY,
        "label" varchar NOT NULL
      );
    `);

    // ends_on_wrong=true so no modo Sobrevivencia (encerra na 1a resposta errada).
    await queryRunner.query(`
      CREATE TABLE "game_difficulty" (
        "id" varchar PRIMARY KEY,
        "title" varchar NOT NULL,
        "number_questions" integer,
        "ends_on_wrong" boolean NOT NULL DEFAULT false
      );
    `);

    // Autenticacao e obrigatoria para jogar: game.user e NOT NULL.
    await queryRunner.query(`
      CREATE TABLE "game" (
        "id" varchar PRIMARY KEY,
        "user" integer NOT NULL REFERENCES "app_user"("id") ON DELETE CASCADE,
        "status" integer NOT NULL REFERENCES "game_status"("id") ON DELETE RESTRICT,
        "difficulty" varchar NOT NULL REFERENCES "game_difficulty"("id") ON DELETE RESTRICT,
        "current_education_level" integer REFERENCES "education_level"("id") ON DELETE SET NULL,
        "current_score" integer NOT NULL DEFAULT 0,
        "current_streak" integer NOT NULL DEFAULT 0,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "finished_at" timestamp
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_game_user" ON "game" ("user");`);
    await queryRunner.query(`CREATE INDEX "idx_game_status" ON "game" ("status");`);

    await queryRunner.query(`
      CREATE TABLE "powerup" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL,
        "description" varchar
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "game_answer" (
        "id" SERIAL PRIMARY KEY,
        "game" varchar NOT NULL REFERENCES "game"("id") ON DELETE CASCADE,
        "question" integer NOT NULL REFERENCES "question"("id") ON DELETE RESTRICT,
        "option" integer REFERENCES "question_option"("id") ON DELETE SET NULL,
        "is_correct" boolean NOT NULL,
        "response_time_ms" integer,
        "sequence" integer NOT NULL,
        "powerup_used" integer REFERENCES "powerup"("id") ON DELETE SET NULL,
        "answered_at" timestamp NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_game_answer_game" ON "game_answer" ("game");`);
    await queryRunner.query(
      `CREATE INDEX "idx_game_answer_question" ON "game_answer" ("question");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_game_answer_correct" ON "game_answer" ("is_correct");`,
    );

    await queryRunner.query(`
      CREATE TABLE "game_powerup" (
        "id" SERIAL PRIMARY KEY,
        "game" varchar NOT NULL REFERENCES "game"("id") ON DELETE CASCADE,
        "powerup" integer NOT NULL REFERENCES "powerup"("id") ON DELETE RESTRICT,
        "is_used" boolean NOT NULL DEFAULT false
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_game_powerup_game" ON "game_powerup" ("game");`);

    // ----- Ranking -----
    await queryRunner.query(`
      CREATE TABLE "ranking" (
        "id" SERIAL PRIMARY KEY,
        "user" integer NOT NULL REFERENCES "app_user"("id") ON DELETE CASCADE,
        "game" varchar NOT NULL REFERENCES "game"("id") ON DELETE CASCADE,
        "score" integer NOT NULL,
        "completed_at" timestamp NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_ranking_score" ON "ranking" ("score" DESC);`);

    // ----- Materialized views (camada analitica) -----
    // Cada MV tem indice UNICO, exigido para REFRESH ... CONCURRENTLY.

    // 1. Taxa de acerto agregada por ODS.
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW mv_acerto_por_ods AS
      SELECT
          g.id                                    AS goal_id,
          g.number                                AS goal_number,
          g.name                                  AS goal_name,
          COUNT(ga.id)                            AS total_respostas,
          COUNT(*) FILTER (WHERE ga.is_correct)   AS total_acertos,
          ROUND(AVG((ga.is_correct)::int), 4)     AS taxa_acerto,
          ROUND(AVG(ga.response_time_ms))         AS tempo_medio_ms
      FROM game_answer ga
      JOIN question q ON q.id = ga.question
      JOIN goal     g ON g.id = q.goal
      GROUP BY g.id, g.number, g.name;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_mv_acerto_por_ods ON mv_acerto_por_ods (goal_id);`,
    );

    // 2. Acerto cruzando escolaridade x ODS (apenas usuarios cadastrados).
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW mv_desempenho_por_escolaridade AS
      SELECT
          ROW_NUMBER() OVER ()                    AS id,
          el.id                                   AS education_level_id,
          el.name                                 AS education_level_name,
          g.id                                    AS goal_id,
          COUNT(ga.id)                            AS total_respostas,
          ROUND(AVG((ga.is_correct)::int), 4)     AS taxa_acerto
      FROM game_answer ga
      JOIN game            gm ON gm.id = ga.game
      JOIN app_user         u ON u.id  = gm."user"
      JOIN education_level el ON el.id = u.education_level
      JOIN question         q ON q.id  = ga.question
      JOIN goal             g ON g.id  = q.goal
      GROUP BY el.id, el.name, g.id;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_mv_desempenho_por_escolaridade ON mv_desempenho_por_escolaridade (id);`,
    );

    // 3. Perguntas a revisar por calibragem ruim.
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW mv_calibragem_perguntas AS
      SELECT
          q.id                                    AS question_id,
          q.goal                                  AS goal_id,
          COUNT(ga.id)                            AS total_respostas,
          ROUND(AVG((ga.is_correct)::int), 4)     AS taxa_acerto,
          CASE
              WHEN COUNT(ga.id) < 30                 THEN 'amostra_insuficiente'
              WHEN AVG((ga.is_correct)::int) >= 0.95 THEN 'muito_facil'
              WHEN AVG((ga.is_correct)::int) <= 0.05 THEN 'muito_dificil'
              ELSE 'ok'
          END                                     AS flag
      FROM question q
      LEFT JOIN game_answer ga ON ga.question = q.id
      GROUP BY q.id, q.goal;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_mv_calibragem_perguntas ON mv_calibragem_perguntas (question_id);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_calibragem_perguntas;`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_desempenho_por_escolaridade;`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_acerto_por_ods;`);
    await queryRunner.query(`DROP TABLE IF EXISTS "ranking";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_powerup";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_answer";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "powerup";`);
    await queryRunner.query(
      `ALTER TABLE "question" DROP CONSTRAINT IF EXISTS "fk_question_answer";`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "game";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_difficulty";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_status";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "question_option";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "question";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "goal";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "school_suggestion";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "school_education_level";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "user_consent";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "app_user";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "role";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "education_level";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "school";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "city";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "state";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "country";`);
  }
}
