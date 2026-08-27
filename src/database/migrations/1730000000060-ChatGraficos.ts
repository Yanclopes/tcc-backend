import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Graficos gerados pelo assistente. Ver tcc-docs/specs/06-chat-ia.md secao "Graficos".
 *
 * Coluna separada de `passos` de proposito: passos e como a resposta foi
 * produzida (auditoria), grafico e conteudo da resposta.
 */
export class ChatGraficos1730000000060 implements MigrationInterface {
  name = 'ChatGraficos1730000000060';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chat_mensagem" ADD COLUMN "graficos" jsonb NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chat_mensagem" DROP COLUMN "graficos"`);
  }
}
