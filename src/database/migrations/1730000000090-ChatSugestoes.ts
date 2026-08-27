import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Respostas rapidas: opcoes clicaveis que o assistente oferece ao fim de uma
 * mensagem, para o administrador nao precisar digitar a proxima pergunta.
 *
 * Sao apenas texto pre-preenchido — clicar envia a frase como uma mensagem
 * normal. Nao executam nada; quem executa continua sendo o cartao de acao.
 */
export class ChatSugestoes1730000000090 implements MigrationInterface {
  name = 'ChatSugestoes1730000000090';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chat_mensagem" ADD COLUMN "sugestoes" jsonb NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "chat_mensagem" DROP COLUMN "sugestoes"`);
  }
}
