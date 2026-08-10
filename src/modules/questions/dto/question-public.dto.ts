import { ApiProperty } from '@nestjs/swagger';
import { Question } from '../entities/question.entity';

class PublicOptionDto {
  @ApiProperty({ example: 12 })
  id: number;

  @ApiProperty({ example: '2015' })
  text: string;
}

/**
 * Representacao da pergunta enviada ao jogador DURANTE a partida.
 * Propositalmente NAO inclui qual opcao e a correta — isso so e revelado
 * apos a resposta, evitando trapaca via inspecao de rede.
 */
export class QuestionPublicDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Em que ano foi aprovada a Agenda 2030 da ONU?' })
  text: string;

  @ApiProperty({ example: 4 })
  goalNumber: number;

  @ApiProperty({ example: 2 })
  difficulty: number;

  @ApiProperty({ type: [PublicOptionDto] })
  options: PublicOptionDto[];

  static fromEntity(question: Question): QuestionPublicDto {
    return {
      id: question.id,
      text: question.text,
      goalNumber: question.goal?.number,
      difficulty: question.difficulty,
      options: (question.options ?? []).map((option) => ({
        id: option.id,
        text: option.text,
      })),
    };
  }
}
