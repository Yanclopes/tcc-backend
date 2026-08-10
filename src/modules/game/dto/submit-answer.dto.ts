import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class SubmitAnswerDto {
  @ApiProperty({ example: 12, description: 'Id da opcao escolhida (question_option.id)' })
  @IsInt()
  optionId: number;

  @ApiPropertyOptional({
    example: 4200,
    description:
      'Tempo de resposta em ms medido no cliente. O servidor tambem calcula pelo Redis ' +
      'e usa o menor valor plausivel, evitando manipulacao para inflar o bonus de velocidade.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  responseTimeMs?: number;
}
