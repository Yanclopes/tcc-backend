import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { QuestionPublicDto } from '../../questions/dto/question-public.dto';

/** Resumo do estado da partida devolvido apos cada acao. */
export class GameStateDto {
  @ApiProperty({ example: '6f9619ff-8b86-d011-b42d-00c04fc964ff' })
  gameId: string;

  @ApiProperty({ example: 350 })
  score: number;

  @ApiProperty({ example: 3 })
  streak: number;

  @ApiProperty({ example: 4, description: 'Perguntas ja respondidas' })
  answered: number;

  @ApiProperty({ example: 15, nullable: true, description: 'Total do modo; null = infinito' })
  totalQuestions: number | null;

  @ApiProperty({ example: { fifty: true, skip: false, audience: true } })
  powerups: Record<string, boolean>;

  @ApiProperty({ example: 'in_progress', enum: ['in_progress', 'finished'] })
  status: string;

  @ApiProperty({
    example: false,
    description: 'true no modo Sobrevivencia: errar encerra a partida.',
  })
  endsOnWrong: boolean;
}

export class StartGameResponseDto extends GameStateDto {}

export class NextQuestionResponseDto {
  @ApiProperty({ type: QuestionPublicDto, nullable: true })
  question: QuestionPublicDto | null;

  @ApiProperty({ type: GameStateDto })
  state: GameStateDto;

  @ApiProperty({
    example: false,
    description: 'true quando nao ha mais perguntas — a partida deve ser finalizada.',
  })
  finished: boolean;
}

export class AnswerResultDto {
  @ApiProperty({ example: true })
  isCorrect: boolean;

  @ApiProperty({ example: 12, description: 'Id da opcao correta (revelado apos responder)' })
  correctOptionId: number;

  @ApiProperty({ example: 175, description: 'Pontos ganhos nesta resposta' })
  earnedPoints: number;

  @ApiProperty({ type: GameStateDto })
  state: GameStateDto;

  @ApiProperty({ example: false, description: 'true quando esta foi a ultima pergunta do modo' })
  finished: boolean;

  @ApiProperty({
    example: false,
    description: 'true quando a partida encerrou por erro no modo Sobrevivencia.',
  })
  eliminated: boolean;
}

export class PowerupResultDto {
  @ApiProperty({ example: 'fifty' })
  powerup: string;

  @ApiPropertyOptional({
    example: [11, 14],
    description: "Ids removidos (power-up 'fifty'/50:50).",
  })
  removedOptionIds?: number[];

  @ApiPropertyOptional({
    example: { 11: 8, 12: 62, 13: 20, 14: 10 },
    description: "Distribuicao percentual simulada da plateia (power-up 'audience').",
  })
  audienceDistribution?: Record<number, number>;

  @ApiPropertyOptional({
    type: NextQuestionResponseDto,
    description: "Proxima pergunta, quando o power-up e 'skip'.",
  })
  next?: NextQuestionResponseDto;

  @ApiProperty({ type: GameStateDto })
  state: GameStateDto;
}

export class FinishGameResponseDto {
  @ApiProperty({ example: '6f9619ff-8b86-d011-b42d-00c04fc964ff' })
  gameId: string;

  @ApiProperty({ example: 1350 })
  finalScore: number;

  @ApiProperty({ example: 12 })
  totalAnswered: number;

  @ApiProperty({ example: 9 })
  totalCorrect: number;
}
