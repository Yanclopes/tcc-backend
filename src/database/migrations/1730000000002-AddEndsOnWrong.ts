import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adiciona a coluna `ends_on_wrong` em game_dificulty. Quando true, a partida
 * encerra na primeira resposta errada (modo Sobrevivencia). Os modos existentes
 * permanecem false: erros nao eliminam, apenas nao pontuam (foco em coleta de dados).
 */
export class AddEndsOnWrong1730000000002 implements MigrationInterface {
  name = 'AddEndsOnWrong1730000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game_dificulty" ADD COLUMN IF NOT EXISTS "ends_on_wrong" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game_dificulty" DROP COLUMN IF EXISTS "ends_on_wrong"`,
    );
  }
}
