import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class CreateQuestionOptionDto {
  @ApiProperty({ example: '2015' })
  @IsString()
  @MinLength(1)
  text: string;
}

export class CreateQuestionDto {
  @ApiProperty({ example: 'Em que ano foi aprovada a Agenda 2030 da ONU?' })
  @IsString()
  @MinLength(5)
  text: string;

  @ApiProperty({ example: 4, description: 'Numero canonico do ODS (1-17)' })
  @IsInt()
  @Min(1)
  @Max(17)
  goalNumber: number;

  @ApiProperty({
    type: [CreateQuestionOptionDto],
    description: 'Exatamente 4 alternativas, na ordem em que serao exibidas.',
  })
  @IsArray()
  @ArrayMinSize(4)
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionOptionDto)
  options: CreateQuestionOptionDto[];

  @ApiProperty({
    example: 2,
    description: 'Indice (base 0) da alternativa correta dentro de "options".',
  })
  @IsInt()
  @Min(0)
  correctOptionIndex: number;

  @ApiPropertyOptional({ example: 2, description: 'Dificuldade 1-5' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @ApiPropertyOptional({ example: 3, description: 'Id do nivel de escolaridade alvo' })
  @IsOptional()
  @IsInt()
  educationLevelId?: number;

  @ApiPropertyOptional({ example: 'ONU, 2015' })
  @IsOptional()
  @IsString()
  source?: string;
}
