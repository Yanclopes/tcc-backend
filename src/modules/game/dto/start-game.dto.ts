import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString } from 'class-validator';

export class StartGameDto {
  @ApiProperty({
    example: 'classic',
    description: 'Id do modo de dificuldade (game_difficulty.id)',
  })
  @IsString()
  difficultyId: string;

  @ApiPropertyOptional({
    example: 3,
    description: 'Nivel de escolaridade do jogador; filtra o publico-alvo das perguntas.',
  })
  @IsOptional()
  @IsInt()
  educationLevelId?: number;
}
