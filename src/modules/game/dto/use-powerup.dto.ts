import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

/** Power-ups suportados pelo motor de jogo. */
export const SUPPORTED_POWERUPS = ['fifty', 'skip', 'audience'] as const;
export type PowerupName = (typeof SUPPORTED_POWERUPS)[number];

export class UsePowerupDto {
  @ApiProperty({
    enum: SUPPORTED_POWERUPS,
    example: 'fifty',
    description:
      "'fifty' (elimina 2 alternativas), 'skip' (troca a pergunta), 'audience' (placar da galera).",
  })
  @IsIn(SUPPORTED_POWERUPS as unknown as string[])
  powerup: PowerupName;
}
