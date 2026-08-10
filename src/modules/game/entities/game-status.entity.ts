import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Game } from './game.entity';

/**
 * Status possiveis de uma partida (ex.: in_progress, finished, abandoned).
 */
@Entity('game_status')
export class GameStatus {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'in_progress' })
  @Column({ type: 'varchar' })
  label: string;

  @OneToMany(() => Game, (game) => game.status)
  games: Game[];
}
