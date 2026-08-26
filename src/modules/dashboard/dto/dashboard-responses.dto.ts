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

  @ApiProperty({
    example: 3,
    description:
      'Quantas perguntas distintas sustentam a taxa. Taxa apoiada em uma unica ' +
      'pergunta mede aquela pergunta, nao o ODS.',
  })
  perguntasDistintas: number;

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

/**
 * Cobertura por escola. Diferente das demais linhas do dashboard, esta parte do
 * catalogo de escolas e nao das respostas — por isso escola com zero
 * participacao aparece, que e justamente o caso que interessa a quem vai agir.
 */
export class SchoolCoverageRowDto {
  @ApiProperty({ example: 1 })
  schoolId: number;

  @ApiProperty({ example: 'UNIDAVI' })
  schoolName: string;

  @ApiProperty({ example: 'Rio do Sul' })
  cityName: string;

  @ApiProperty({ example: 12, description: 'Usuarios cadastrados com esta escola no perfil.' })
  totalCadastrados: number;

  @ApiProperty({ example: 30 })
  totalPartidas: number;

  @ApiProperty({ example: 0, description: 'Zero significa que a participacao nao chegou.' })
  totalRespostas: number;
}
