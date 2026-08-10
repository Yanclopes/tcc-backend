import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Powerup } from '../../powerups/entities/powerup.entity';
import { Question } from '../../questions/entities/question.entity';
import { QuestionOption } from '../../questions/entities/question-option.entity';
import { Game } from './game.entity';

/**
 * Tabela mais critica do projeto: registro bruto de cada resposta. E a fonte
 * primaria de todo o levantamento estatistico feito na camada analitica.
 */
@Entity('game_answer')
export class GameAnswer {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Game, (game) => game.answers, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'game' })
  game: Game;

  @ManyToOne(() => Question, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'question' })
  question: Question;

  @ManyToOne(() => QuestionOption, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'option' })
  option?: QuestionOption | null;

  @ApiProperty({
    example: true,
    description: 'Denormalizado: simplifica as queries analiticas.',
  })
  @Column({ type: 'boolean' })
  isCorrect: boolean;

  @ApiProperty({
    example: 4200,
    description: 'Tempo ate responder (ms) - distingue saber de hesitar/chutar.',
  })
  @Column({ type: 'int', nullable: true })
  responseTimeMs?: number | null;

  @ApiProperty({
    example: 3,
    description: 'Ordem da pergunta na partida - controla fadiga/efeito de posicao.',
  })
  @Column({ type: 'int' })
  sequence: number;

  @ApiProperty({
    example: null,
    description: 'FK -> powerup.id. null = sem ajuda. Separa acerto puro de acerto com ajuda.',
    nullable: true,
  })
  @ManyToOne(() => Powerup, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'powerup_used' })
  powerupUsed?: Powerup | null;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp' })
  answeredAt: Date;
}
