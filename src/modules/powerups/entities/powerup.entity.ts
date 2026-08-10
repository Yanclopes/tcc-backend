import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { GamePowerup } from './game-powerup.entity';

/**
 * Catalogo de ajudas (power-ups) disponiveis no jogo.
 * Ex.: 'skip' (pular), 'fifty' (elimina 2 opcoes), 'audience' (placar da galera).
 */
@Entity('powerup')
export class Powerup {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'fifty', description: "Ex.: 'skip', 'fifty', 'audience'" })
  @Column({ type: 'varchar' })
  name: string;

  @ApiProperty({ example: 'Elimina duas alternativas incorretas.' })
  @Column({ type: 'varchar', nullable: true })
  description?: string | null;

  @OneToMany(() => GamePowerup, (gamePowerup) => gamePowerup.powerup)
  gamePowerups: GamePowerup[];
}
