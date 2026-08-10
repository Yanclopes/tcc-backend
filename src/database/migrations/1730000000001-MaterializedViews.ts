import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Camada analitica: materialized views que sustentam o levantamento estatistico
 * do TCC. O SQL e o mesmo documentado no modelo dbdiagram. Cada view tem um
 * indice UNICO, exigido para permitir REFRESH ... CONCURRENTLY sem travar leitura.
 */
export class MaterializedViews1730000000001 implements MigrationInterface {
  name = 'MaterializedViews1730000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Taxa de acerto agregada por ODS.
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW mv_acerto_por_ods AS
      SELECT
          g.id                                    AS goal_id,
          g.number                                AS goal_number,
          g.name                                  AS goal_name,
          COUNT(ga.id)                            AS total_respostas,
          COUNT(*) FILTER (WHERE ga.is_correct)   AS total_acertos,
          ROUND(AVG((ga.is_correct)::int), 4)     AS taxa_acerto,
          ROUND(AVG(ga.response_time_ms))         AS tempo_medio_ms
      FROM game_answer ga
      JOIN question q ON q.id = ga.question
      JOIN goal     g ON g.id = q.goal
      GROUP BY g.id, g.number, g.name;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_mv_acerto_por_ods ON mv_acerto_por_ods (goal_id);`,
    );

    // 2. Acerto cruzando escolaridade x ODS (apenas usuarios cadastrados).
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW mv_desempenho_por_escolaridade AS
      SELECT
          ROW_NUMBER() OVER ()                    AS id,
          el.id                                   AS education_level_id,
          el.name                                 AS education_level_name,
          g.id                                    AS goal_id,
          COUNT(ga.id)                            AS total_respostas,
          ROUND(AVG((ga.is_correct)::int), 4)     AS taxa_acerto
      FROM game_answer ga
      JOIN game            gm ON gm.id = ga.game
      JOIN app_user         u ON u.id  = gm."user"
      JOIN education_level el ON el.id = u.education_level
      JOIN question         q ON q.id  = ga.question
      JOIN goal             g ON g.id  = q.goal
      GROUP BY el.id, el.name, g.id;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_mv_desempenho_por_escolaridade ON mv_desempenho_por_escolaridade (id);`,
    );

    // 3. Perguntas a revisar por calibragem ruim.
    await queryRunner.query(`
      CREATE MATERIALIZED VIEW mv_calibragem_perguntas AS
      SELECT
          q.id                                    AS question_id,
          q.goal                                  AS goal_id,
          COUNT(ga.id)                            AS total_respostas,
          ROUND(AVG((ga.is_correct)::int), 4)     AS taxa_acerto,
          CASE
              WHEN COUNT(ga.id) < 30                 THEN 'amostra_insuficiente'
              WHEN AVG((ga.is_correct)::int) >= 0.95 THEN 'muito_facil'
              WHEN AVG((ga.is_correct)::int) <= 0.05 THEN 'muito_dificil'
              ELSE 'ok'
          END                                     AS flag
      FROM question q
      LEFT JOIN game_answer ga ON ga.question = q.id
      GROUP BY q.id, q.goal;
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX idx_mv_calibragem_perguntas ON mv_calibragem_perguntas (question_id);`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_calibragem_perguntas;`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_desempenho_por_escolaridade;`);
    await queryRunner.query(`DROP MATERIALIZED VIEW IF EXISTS mv_acerto_por_ods;`);
  }
}
