import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LGPD L3 — anonimizacao como alternativa ao direito ao esquecimento (L2).
 *
 * Adiciona flag e carimbo temporal em app_user. O fluxo /users/me/anonymize
 * substitui PII (nome/e-mail/senha) por valores anonimos, marca esta flag e
 * bloqueia login subsequente — preservando dados demograficos (estado,
 * cidade, escola, escolaridade) e a coleta bruta (games, game_answer, ranking)
 * como amostra estatistica anonima da pesquisa.
 */
export class AnonymizeSupport1730000000040 implements MigrationInterface {
  name = 'AnonymizeSupport1730000000040';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_user" ADD COLUMN "is_anonymized" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "app_user" ADD COLUMN "anonymized_at" timestamp NULL`);
    await queryRunner.query(
      `CREATE INDEX "idx_app_user_anonymized" ON "app_user" ("is_anonymized") WHERE "is_anonymized" = true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_app_user_anonymized"`);
    await queryRunner.query(`ALTER TABLE "app_user" DROP COLUMN "anonymized_at"`);
    await queryRunner.query(`ALTER TABLE "app_user" DROP COLUMN "is_anonymized"`);
  }
}
