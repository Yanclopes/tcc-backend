import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Acoes administrativas propostas pelo assistente.
 *
 * Coluna separada de `graficos` e `passos`: a proposta tem ciclo de vida
 * proprio (pendente -> confirmada/descartada) e precisa sobreviver a um reload
 * da conversa, senao o administrador perderia o que estava prestes a confirmar.
 */
export class ChatAcoes1730000000080 implements MigrationInterface {
  name = 'ChatAcoes1730000000080';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chat_mensagem" ADD COLUMN "acoes" jsonb NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chat_mensagem" DROP COLUMN "acoes"`);
  }
}
