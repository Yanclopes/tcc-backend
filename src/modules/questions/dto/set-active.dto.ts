import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class SetActiveDto {
  @ApiProperty({ example: false, description: 'true ativa a pergunta; false a desativa.' })
  @IsBoolean()
  isActive: boolean;
}
