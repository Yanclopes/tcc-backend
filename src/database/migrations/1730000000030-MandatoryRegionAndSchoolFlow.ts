import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona ao app_user as colunas de estado/cidade (agora obrigatorias no DTO
 * de cadastro para nao perder o recorte regional), a flag de re-registro forcado
 * e o motivo da rejeicao. Adiciona a school_suggestion o motivo da rejeicao e o
 * status 'linked' (usado quando o admin vincula a sugestao a uma escola ja
 * existente, sem penalizar o aluno).
 *
 * State/city ficam nullable no DB para acomodar usuarios historicos; a
 * obrigatoriedade e enforcada na camada de DTO. O backfill preenche esses
 * campos a partir da escola do usuario, quando existir.
 */
export class MandatoryRegionAndSchoolFlow1730000000030 implements MigrationInterface {
  name = 'MandatoryRegionAndSchoolFlow1730000000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "app_user" ADD COLUMN "state" integer REFERENCES "state"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ADD COLUMN "city" integer REFERENCES "city"("id") ON DELETE RESTRICT`,
    );
    await queryRunner.query(
      `ALTER TABLE "app_user" ADD COLUMN "needs_school_reregistration" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(`ALTER TABLE "app_user" ADD COLUMN "school_rejection_reason" text`);
    await queryRunner.query(`ALTER TABLE "school_suggestion" ADD COLUMN "rejection_reason" text`);

    // Backfill state/city a partir da escola dos usuarios que ja tem uma.
    await queryRunner.query(`
      UPDATE "app_user" u
      SET "city" = s."city",
          "state" = c."state"
      FROM "school" s
      JOIN "city" c ON c."id" = s."city"
      WHERE u."school" = s."id"
    `);

    await queryRunner.query(`CREATE INDEX "idx_app_user_state" ON "app_user" ("state")`);
    await queryRunner.query(`CREATE INDEX "idx_app_user_city" ON "app_user" ("city")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_app_user_city"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_app_user_state"`);
    await queryRunner.query(`ALTER TABLE "school_suggestion" DROP COLUMN "rejection_reason"`);
    await queryRunner.query(`ALTER TABLE "app_user" DROP COLUMN "school_rejection_reason"`);
    await queryRunner.query(`ALTER TABLE "app_user" DROP COLUMN "needs_school_reregistration"`);
    await queryRunner.query(`ALTER TABLE "app_user" DROP COLUMN "city"`);
    await queryRunner.query(`ALTER TABLE "app_user" DROP COLUMN "state"`);
  }
}
