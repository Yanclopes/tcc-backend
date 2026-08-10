import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateSchoolDto {
  @ApiProperty({ example: 'EEB Paulo Zimmermann' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @ApiProperty({ example: 1, description: 'Id da cidade da escola' })
  @IsInt()
  cityId: number;

  @ApiProperty({
    example: [2, 3],
    description: 'Ids dos niveis de escolaridade que a escola atende.',
    type: [Number],
  })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  educationLevelIds: number[];
}

export class UpdateSchoolDto extends PartialType(CreateSchoolDto) {}

/** Sugestao de escola inexistente, feita por um aluno. */
export class CreateSchoolSuggestionDto {
  @ApiProperty({ example: 'Escola Municipal Sao Jose' })
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name: string;

  @ApiProperty({ example: 1, description: 'Id da cidade onde fica a escola' })
  @IsInt()
  cityId: number;

  @ApiPropertyOptional({ example: 'Fica no bairro Centro' })
  @IsOptional()
  @IsString()
  @MaxLength(240)
  note?: string;
}

/** Dados usados pelo admin ao aprovar uma sugestao (pode ajustar antes de criar). */
export class ApproveSuggestionDto {
  @ApiPropertyOptional({
    example: 'EEB Sao Jose',
    description: 'Nome final da escola (se omitido, usa o nome sugerido).',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name?: string;

  @ApiPropertyOptional({ example: 1, description: 'Cidade final (se omitida, usa a sugerida).' })
  @IsOptional()
  @IsInt()
  cityId?: number;

  @ApiProperty({
    example: [2, 3],
    description: 'Niveis de escolaridade que a escola atende.',
    type: [Number],
  })
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  educationLevelIds: number[];
}
