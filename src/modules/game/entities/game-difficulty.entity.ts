import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, OneToMany, PrimaryColumn } from 'typeorm';
import { Game } from './game.entity';

/**
 * Modo de dificuldade do jogo. Chave primaria textual (ex.: 'easy', 'endless').
 * Mantem o nome de coluna 'dificulty' do schema original.
 */
@Entity('game_dificulty')
export class GameDifficulty {
  @ApiProperty({ example: 'classic', description: 'Identificador textual do modo' })
  @PrimaryColumn({ type: 'varchar' })
  id: string;

  @ApiProperty({ example: 'Classico' })
  @Column({ type: 'varchar' })
  title: string;

  @ApiProperty({
    example: 15,
    description: 'Quantidade de perguntas. Se null, o modo e infinito (endless).',
    nullable: true,
  })
  @Column({ type: 'int', nullable: true })
  numberQuestions?: number | null;

  @ApiProperty({
    example: false,
    description:
      'Se true, a partida encerra imediatamente na primeira resposta errada (modo Sobrevivencia).',
  })
  @Column({ type: 'boolean', default: false })
  endsOnWrong: boolean;

  @OneToMany(() => Game, (game) => game.difficulty)
  games: Game[];
}
