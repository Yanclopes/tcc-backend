import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';
import { EducationLevel } from '../../users/entities/education-level.entity';
import { AppUser } from '../../users/entities/app-user.entity';
import { GameAnswer } from './game-answer.entity';
import { GameDifficulty } from './game-difficulty.entity';
import { GameStatus } from './game-status.entity';

/**
 * Partida. A chave primaria e um UUID (string) gerado pela aplicacao, o que
 * facilita o uso como chave de sessao no Redis e evita expor ids sequenciais.
 */
@Entity('game')
export class Game {
  @ApiProperty({ example: '6f9619ff-8b86-d011-b42d-00c04fc964ff' })
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user' })
  user: AppUser;

  @ManyToOne(() => GameStatus, (status) => status.games, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'status' })
  status: GameStatus;

  @ManyToOne(() => GameDifficulty, (difficulty) => difficulty.games, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'difficulty' })
  difficulty: GameDifficulty;

  @ManyToOne(() => EducationLevel, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'current_education_level' })
  currentEducationLevel?: EducationLevel | null;

  @ApiProperty({ example: 0 })
  @Column({ type: 'int', default: 0 })
  currentScore: number;

  @ApiProperty({ example: 0 })
  @Column({ type: 'int', default: 0 })
  currentStreak: number;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @ApiProperty({ nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  finishedAt?: Date | null;

  @OneToMany(() => GameAnswer, (answer) => answer.game)
  answers: GameAnswer[];
}
