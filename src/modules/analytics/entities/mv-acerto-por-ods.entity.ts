import { ApiProperty } from '@nestjs/swagger';
import { ViewColumn, ViewEntity } from 'typeorm';

/**
 * MATERIALIZED VIEW: taxa de acerto agregada por ODS.
 * A view fisica e criada/refreshada via migration (SQL real la). Aqui apenas
 * mapeamos para leitura tipada. synchronize:false impede o TypeORM de recria-la.
 */
@ViewEntity({ name: 'mv_acerto_por_ods', synchronize: false })
export class MvAcertoPorOds {
  @ApiProperty({ example: 4 })
  @ViewColumn()
  goalId: number;

  @ApiProperty({ example: 4 })
  @ViewColumn()
  goalNumber: number;

  @ApiProperty({ example: 'Educacao de Qualidade' })
  @ViewColumn()
  goalName: string;

  @ApiProperty({ example: 320 })
  @ViewColumn()
  totalRespostas: number;

  @ApiProperty({ example: 210 })
  @ViewColumn()
  totalAcertos: number;

  @ApiProperty({ example: 0.6563, description: 'total_acertos / total_respostas' })
  @ViewColumn()
  taxaAcerto: number;

  @ApiProperty({ example: 5200 })
  @ViewColumn()
  tempoMedioMs: number;
}
