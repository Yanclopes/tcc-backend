import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { Game } from '../../game/entities/game.entity';
import { Powerup } from './powerup.entity';

/**
 * Controla o SALDO de ajudas por partida (quantas ainda restam).
 * O USO efetivo por pergunta fica em game_answer.powerup_used.
 */
@Entity('game_powerup')
export class GamePowerup {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Game, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'game' })
  game: Game;

  @ManyToOne(() => Powerup, (powerup) => powerup.gamePowerups, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'powerup' })
  powerup: Powerup;

  @ApiProperty({ example: false })
  @Column({ type: 'boolean', default: false })
  isUsed: boolean;
}
