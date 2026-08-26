import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * mv_desempenho_por_escolaridade passa a expor o NUMERO e o NOME do ODS.
 *
 * A view expunha apenas `goal_id`. Hoje id e number coincidem, mas a convencao
 * do projeto e que toda regra de negocio use `goal.number` justamente porque o
 * id e autoincrement e muda em um reseed (ver .specs/db-schema-descricao.md).
 * Qualquer consumidor que rotulasse "ODS {goal_id}" quebraria em silencio.
 *
 * Motivada pelo heatmap escolaridade x ODS do assistente, que precisa rotular
 * as colunas — mas corrige a view para todos os consumidores.
 */
export class MvEscolaridadeComOdsNumber1730000000070 implements MigrationInterface {
  name = 'MvEscolaridadeComOdsNumber1730000000070';

  private readonly colunasNovas = `
      row_number() OVER () AS id,
      el.id AS education_level_id,
      el.name AS education_level_name,
      g.id AS goal_id,
      g.number AS goal_number,
      g.name AS goal_name,
      count(ga.id) AS total_respostas,
      round(avg((ga.is_correct)::integer), 4) AS taxa_acerto`;

  private readonly colunasAntigas = `
      row_number() OVER () AS id,
      el.id AS education_level_id,
      el.name AS education_level_name,
      g.id AS goal_id,
      count(ga.id) AS total_respostas,
      round(avg((ga.is_correct)::integer), 4) AS taxa_acerto`;

  private corpo(colunas: string, agrupamento: string): string {
    return `
      SELECT ${colunas}
        FROM game_answer ga
        JOIN game gm ON gm.id::text = ga.game::text
        JOIN app_user u ON u.id = gm."user"
        JOIN education_level el ON el.id = u.education_level
        JOIN question q ON q.id = ga.question
        JOIN goal g ON g.id = q.goal
       GROUP BY ${agrupamento}`;
  }

  private async recriar(queryRunner: QueryRunner, colunas: string, agrupamento: string) {
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS "mv_desempenho_por_escolaridade"`);
    await queryRunner.query(
      `CREATE MATERIALIZED VIEW "mv_desempenho_por_escolaridade" AS ${this.corpo(colunas, agrupamento)}`,
    );
    // O indice unico e o que permite REFRESH CONCURRENTLY.
    await queryRunner.query(
      `CREATE UNIQUE INDEX "idx_mv_desempenho_por_escolaridade" ON "mv_desempenho_por_escolaridade" ("id")`,
    );
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.recriar(queryRunner, this.colunasNovas, 'el.id, el.name, g.id, g.number, g.name');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.recriar(queryRunner, this.colunasAntigas, 'el.id, el.name, g.id');
  }
}
