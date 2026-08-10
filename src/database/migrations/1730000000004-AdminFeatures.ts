import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Recursos administrativos:
 * - `school_education_level`: niveis de escolaridade atendidos por cada escola (N:N).
 * - `school_suggestion`: escolas sugeridas por alunos no cadastro, para o admin
 *   revisar e aprovar (criando a School real e vinculando o aluno).
 */
export class AdminFeatures1730000000004 implements MigrationInterface {
  name = 'AdminFeatures1730000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "school_education_level" (
        "school" integer NOT NULL,
        "education_level" integer NOT NULL,
        CONSTRAINT "pk_school_education_level" PRIMARY KEY ("school", "education_level"),
        CONSTRAINT "fk_sel_school" FOREIGN KEY ("school") REFERENCES "school"("id") ON DELETE CASCADE,
        CONSTRAINT "fk_sel_level" FOREIGN KEY ("education_level") REFERENCES "education_level"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_sel_level" ON "school_education_level" ("education_level")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "school_suggestion" (
        "id" SERIAL NOT NULL,
        "name" varchar NOT NULL,
        "city" integer NOT NULL,
        "note" varchar,
        "suggested_by" integer,
        "status" varchar NOT NULL DEFAULT 'pending',
        "created_school" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "resolved_at" TIMESTAMP,
        CONSTRAINT "pk_school_suggestion" PRIMARY KEY ("id"),
        CONSTRAINT "fk_suggestion_city" FOREIGN KEY ("city") REFERENCES "city"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_suggestion_user" FOREIGN KEY ("suggested_by") REFERENCES "app_user"("id") ON DELETE SET NULL,
        CONSTRAINT "fk_suggestion_school" FOREIGN KEY ("created_school") REFERENCES "school"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "idx_suggestion_status" ON "school_suggestion" ("status")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "school_suggestion"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "school_education_level"`);
  }
}
