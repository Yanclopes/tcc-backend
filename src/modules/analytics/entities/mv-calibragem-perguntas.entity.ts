import { ApiProperty } from '@nestjs/swagger';
import { ViewColumn, ViewEntity } from 'typeorm';

/**
 * MATERIALIZED VIEW: perguntas a revisar por calibragem ruim (muito faceis,
 * muito dificeis ou com amostra insuficiente).
 */
@ViewEntity({ name: 'mv_calibragem_perguntas', synchronize: false })
export class MvCalibragemPerguntas {
  @ApiProperty({ example: 1 })
  @ViewColumn()
  questionId: number;

  @ApiProperty({ example: 4 })
  @ViewColumn()
  goalId: number;

  @ApiProperty({ example: 42 })
  @ViewColumn()
  totalRespostas: number;

  @ApiProperty({ example: 0.9761 })
  @ViewColumn()
  taxaAcerto: number;

  @ApiProperty({
    example: 'muito_facil',
    description: "'muito_facil', 'muito_dificil', 'ok' ou 'amostra_insuficiente'",
  })
  @ViewColumn()
  flag: string;
}
