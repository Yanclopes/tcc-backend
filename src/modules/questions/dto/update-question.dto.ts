import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { CreateQuestionOptionDto } from './create-question.dto';

/**
 * Atualizacao parcial de pergunta. Se `options` for enviado, TODAS as
 * alternativas sao substituidas e `correctOptionIndex` passa a ser obrigatorio.
 */
export class UpdateQuestionDto {
  @ApiPropertyOptional({ example: 'Em que ano foi aprovada a Agenda 2030 da ONU?' })
  @IsOptional()
  @IsString()
  @MinLength(5)
  text?: string;

  @ApiPropertyOptional({ example: 4, description: 'Numero canonico do ODS (1-17)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(17)
  goalNumber?: number;

  @ApiPropertyOptional({
    type: [CreateQuestionOptionDto],
    description: 'Se informado, substitui todas as alternativas (min. 4).',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(4)
  @ValidateNested({ each: true })
  @Type(() => CreateQuestionOptionDto)
  options?: CreateQuestionOptionDto[];

  @ApiPropertyOptional({
    example: 2,
    description: 'Indice (base 0) da alternativa correta. Obrigatorio se enviar options.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  correctOptionIndex?: number;

  @ApiPropertyOptional({ example: 2, description: 'Dificuldade 1-5' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  difficulty?: number;

  @ApiPropertyOptional({ example: 3, description: 'Id do nivel de escolaridade alvo (null limpa)' })
  @IsOptional()
  @IsInt()
  educationLevelId?: number;

  @ApiPropertyOptional({ example: 'ONU, 2015' })
  @IsOptional()
  @IsString()
  source?: string;

  @ApiPropertyOptional({ example: true, description: 'Ativa/desativa a pergunta no jogo' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
