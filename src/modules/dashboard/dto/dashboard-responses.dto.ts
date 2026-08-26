import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

  @ApiProperty({
    example: 480,
    description:
      'Partidas com AO MENOS UMA resposta. Nao e o total de partidas criadas: quem abriu e ' +
      'saiu antes de responder nao entra, de proposito — partida sem resposta nao contribui ' +
      'para nenhuma taxa e so distorceria o denominador.',
  })
  totalPartidas: number;

  @ApiProperty({
    example: 24,
    description:
      'Dessas, quantas tem finished_at preenchido. A diferenca para totalPartidas e o ' +
      'abandono de quem chegou a responder — que e o abandono que interessa. Cuidado: em ' +
      'Sobrevivencia e Infinito o encerramento e regra do jogo, nao abandono.',
  })
  partidasFinalizadas: number;

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
 * Cobertura do catalogo por ODS. Parte de `goal`, entao ODS sem nenhuma
 * pergunta cadastrada aparece com zeros — que e justamente a lacuna a agir.
 */
export class OdsCoverageRowDto {
  @ApiProperty({ example: 6 })
  goalNumber: number;

  @ApiProperty({ example: 'Agua Potavel e Saneamento' })
  goalName: string;

  @ApiProperty({ example: 3, description: 'Perguntas existentes no banco para este ODS.' })
  perguntasCadastradas: number;

  @ApiProperty({ example: 2, description: 'Dessas, quantas estao ativas (sendo servidas).' })
  perguntasAtivas: number;

  @ApiProperty({
    example: 1,
    description: 'Dessas, quantas ja receberam ao menos uma resposta. Diferente de cadastradas.',
  })
  perguntasComResposta: number;

  @ApiProperty({ example: 10 })
  totalRespostas: number;
}

/**
 * Cobertura geografica (cidade ou escola). Parte do catalogo e nao das
 * respostas, entao participacao zero aparece como linha.
 *
 * Os nomes dos campos sao explicitos de proposito: este payload vai para o
 * modelo de linguagem como retorno de ferramenta, e chave generica ('nome',
 * 'contexto') levou o modelo a rotular cidade com nome de estado.
 */
export class CoverageRowDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiPropertyOptional({ example: 'UNIDAVI', description: 'Apenas no nivel escola.' })
  escola?: string;

  @ApiProperty({ example: 'Rio do Sul' })
  cidade: string;

  @ApiPropertyOptional({ example: 'Santa Catarina', description: 'Apenas no nivel cidade.' })
  estado?: string;

  @ApiProperty({ example: 12, description: 'Usuarios com este vinculo no perfil.' })
  alunosCadastrados: number;

  @ApiProperty({ example: 30 })
  partidas: number;

  @ApiProperty({ example: 0, description: 'Zero significa que a participacao nao chegou.' })
  respostas: number;
}
