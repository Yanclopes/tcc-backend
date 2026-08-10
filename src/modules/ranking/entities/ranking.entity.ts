import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Game } from '../../game/entities/game.entity';
import { AppUser } from '../../users/entities/app-user.entity';

/**
 * Ranking denormalizado por performance. Poderia ser uma VIEW derivada de
 * game + game_answer, mas e mantido como tabela para leitura rapida do placar.
 */
@Entity('ranking')
export class Ranking {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user' })
  user?: AppUser | null;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'game' })
  game: Game;

  @ApiProperty({ example: 1200 })
  @Column({ type: 'int' })
  score: number;

  @ApiProperty()
  @Column({ type: 'timestamp' })
  completedAt: Date;
}
