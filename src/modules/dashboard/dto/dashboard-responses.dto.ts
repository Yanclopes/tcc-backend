import { ApiProperty } from '@nestjs/swagger';

/** KPIs consolidados do levantamento (respeitando os filtros aplicados). */
export class DashboardOverviewDto {
  @ApiProperty({ example: 5230, description: 'Total de respostas coletadas' })
  totalRespostas: number;

  @ApiProperty({ example: 3120, description: 'Total de respostas corretas' })
  totalAcertos: number;

  @ApiProperty({ example: 0.5966, description: 'Taxa de acerto (0-1)' })
  taxaAcerto: number;

  @ApiProperty({ example: 5400, description: 'Tempo medio de resposta (ms)' })
  tempoMedioMs: number;

  @ApiProperty({ example: 480, description: 'Total de partidas' })
  totalPartidas: number;

  @ApiProperty({ example: 210, description: 'Participantes autenticados distintos' })
  totalParticipantes: number;
}

export class OdsBreakdownRowDto {
  @ApiProperty({ example: 13 })
  goalNumber: number;

  @ApiProperty({ example: 'Acao Contra a Mudanca Global do Clima' })
  goalName: string;

  @ApiProperty({ example: 320 })
  totalRespostas: number;

  @ApiProperty({ example: 210 })
  totalAcertos: number;

  @ApiProperty({ example: 0.6563 })
  taxaAcerto: number;

  @ApiProperty({ example: 5200 })
  tempoMedioMs: number;
}

export class RegionBreakdownRowDto {
  @ApiProperty({ example: 'state', enum: ['state', 'city', 'school'] })
  level: string;

  @ApiProperty({ example: 1, description: 'Id da regiao (estado/cidade/escola)' })
  regionId: number;

  @ApiProperty({ example: 'Santa Catarina' })
  regionLabel: string;

  @ApiProperty({ example: 640 })
  totalRespostas: number;

  @ApiProperty({ example: 0.61 })
  taxaAcerto: number;

  @ApiProperty({ example: 5300 })
  tempoMedioMs: number;

  @ApiProperty({ example: 58, description: 'Participantes autenticados distintos na regiao' })
  totalParticipantes: number;
}

export class QuestionBreakdownRowDto {
  @ApiProperty({ example: 42 })
  questionId: number;

  @ApiProperty({ example: 'Em que ano a ONU aprovou a Agenda 2030?' })
  questionText: string;

  @ApiProperty({ example: 4 })
  goalNumber: number;

  @ApiProperty({ example: 150 })
  totalRespostas: number;

  @ApiProperty({ example: 0.82 })
  taxaAcerto: number;

  @ApiProperty({ example: 4800 })
  tempoMedioMs: number;
}
