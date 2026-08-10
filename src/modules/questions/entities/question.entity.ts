import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Goal } from '../../goals/entities/goal.entity';
import { EducationLevel } from '../../users/entities/education-level.entity';
import { QuestionOption } from './question-option.entity';

@Entity('question')
export class Question {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Em que ano foi aprovada a Agenda 2030 da ONU?' })
  @Column({ type: 'varchar' })
  text: string;

  @ManyToOne(() => Goal, (goal) => goal.questions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'goal' })
  goal: Goal;

  /**
   * FK -> question_option.id: aponta a opcao correta.
   * Nullable no banco porque a pergunta e criada antes de existirem as opcoes;
   * o servico garante que seja preenchida antes de ativar a pergunta.
   */
  @ApiProperty({ example: 3, description: 'Id da opcao correta (question_option.id)' })
  @Column({ name: 'answer', type: 'int', nullable: true })
  answerOptionId?: number | null;

  @ManyToOne(() => EducationLevel, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'education_level' })
  educationLevel?: EducationLevel | null;

  @ApiProperty({
    example: 2,
    description: 'Dificuldade empirica (1-5). Comeca manual e recalibra com dados reais (TRI).',
  })
  @Column({ type: 'int', default: 1 })
  difficulty: number;

  @ApiProperty({ example: 'ONU, 2015', description: 'Fonte do dado da pergunta' })
  @Column({ type: 'varchar', nullable: true })
  source?: string | null;

  @ApiProperty({ example: true })
  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => QuestionOption, (option) => option.question, { cascade: true })
  options: QuestionOption[];
}
