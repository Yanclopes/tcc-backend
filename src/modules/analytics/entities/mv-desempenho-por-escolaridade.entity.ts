import { ApiProperty } from '@nestjs/swagger';
import { ViewColumn, ViewEntity } from 'typeorm';

/**
 * MATERIALIZED VIEW: acerto cruzando escolaridade x ODS (so usuarios cadastrados).
 */
@ViewEntity({ name: 'mv_desempenho_por_escolaridade', synchronize: false })
export class MvDesempenhoPorEscolaridade {
  @ApiProperty({ example: 1, description: 'Chave sintetica (education_level + goal)' })
  @ViewColumn()
  id: number;

  @ApiProperty({ example: 2 })
  @ViewColumn()
  educationLevelId: number;

  @ApiProperty({ example: 'Ensino Medio' })
  @ViewColumn()
  educationLevelName: string;

  @ApiProperty({ example: 4 })
  @ViewColumn()
  goalId: number;

  @ApiProperty({
    example: 13,
    description: 'Numero canonico do ODS (1-17). Use este, nao o goalId — ver a migration.',
  })
  @ViewColumn()
  goalNumber: number;

  @ApiProperty({ example: 'Acao Contra a Mudanca Global do Clima' })
  @ViewColumn()
  goalName: string;

  @ApiProperty({ example: 120 })
  @ViewColumn()
  totalRespostas: number;

  @ApiProperty({ example: 0.7125 })
  @ViewColumn()
  taxaAcerto: number;
}
