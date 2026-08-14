import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Tabela audit_log — trilha de auditoria de acoes sensiveis (mudanca de
 * papel, aprovacao/rejeicao de sugestao de escola, self-delete LGPD etc.).
 *
 * user_id e nullable com ON DELETE SET NULL: se o ator for excluido (self-delete),
 * preservamos o registro historico sem quebrar integridade.
 */
export class AuditLog1730000000010 implements MigrationInterface {
  name = 'AuditLog1730000000010';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "audit_log" (
        "id" SERIAL PRIMARY KEY,
        "user_id" integer REFERENCES "app_user"("id") ON DELETE SET NULL,
        "action" varchar NOT NULL,
        "target_type" varchar,
        "target_id" varchar,
        "metadata" jsonb,
        "at" timestamp NOT NULL DEFAULT now()
      );
    `);
    await queryRunner.query(`CREATE INDEX "idx_audit_log_action" ON "audit_log" ("action");`);
    await queryRunner.query(`CREATE INDEX "idx_audit_log_user" ON "audit_log" ("user_id");`);
    await queryRunner.query(`CREATE INDEX "idx_audit_log_at" ON "audit_log" ("at" DESC);`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "audit_log";`);
  }
}
