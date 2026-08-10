import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema inicial completo do "Desafio ODS", portado do modelo
 * concebido no dbdiagram. Ordem de criacao respeita as dependencias de FK.
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

    await queryRunner.query(`
      CREATE TABLE "app_user" (
        "id" SERIAL PRIMARY KEY,
        "name" varchar NOT NULL,
        "email" varchar NOT NULL UNIQUE,
        "password" varchar NOT NULL,
        "school" integer REFERENCES "school"("id") ON DELETE SET NULL,
        "education_level" integer REFERENCES "education_level"("id") ON DELETE SET NULL,
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
    await queryRunner.query(
      `CREATE INDEX "idx_question_difficulty" ON "question" ("difficulty");`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_question_active" ON "question" ("is_active");`,
    );

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

    await queryRunner.query(`
      CREATE TABLE "game_dificulty" (
        "id" varchar PRIMARY KEY,
        "title" varchar NOT NULL,
        "number_questions" integer
      );
    `);

    await queryRunner.query(`
      CREATE TABLE "game" (
        "id" varchar PRIMARY KEY,
        "user" integer REFERENCES "app_user"("id") ON DELETE SET NULL,
        "status" integer NOT NULL REFERENCES "game_status"("id") ON DELETE RESTRICT,
        "dificulty" varchar NOT NULL REFERENCES "game_dificulty"("id") ON DELETE RESTRICT,
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
        "user" integer REFERENCES "app_user"("id") ON DELETE SET NULL,
        "game" varchar NOT NULL REFERENCES "game"("id") ON DELETE CASCADE,
        "score" integer NOT NULL,
        "completed_at" timestamp NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_ranking_score" ON "ranking" ("score" DESC);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "ranking";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_powerup";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_answer";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "powerup";`);
    await queryRunner.query(`ALTER TABLE "question" DROP CONSTRAINT IF EXISTS "fk_question_answer";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_dificulty";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_status";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "question_option";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "question";`);
    await queryRunner.query(`DROP TABLE IF EXISTS "goal";`);
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
