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

/** Vincula a sugestao a uma escola ja existente no catalogo (o admin identificou duplicidade). */
export class LinkSuggestionDto {
  @ApiProperty({ example: 1, description: 'Id da escola existente a ser vinculada.' })
  @IsInt()
  schoolId: number;
}

/** Rejeicao de sugestao — o motivo e apresentado ao aluno no proximo login. */
export class RejectSuggestionDto {
  @ApiProperty({
    example: 'Nome muito generico — informe o nome completo da escola.',
    description: 'Motivo da rejeicao (obrigatorio; visivel ao aluno no re-registro).',
  })
  @IsString()
  @MinLength(4)
  @MaxLength(500)
  reason: string;
}

/** Payload para o aluno reajustar seu perfil regional apos rejeicao. */
export class UpdateOwnSchoolDto {
  @ApiProperty({ example: 1 })
  @IsInt()
  stateId: number;

  @ApiProperty({ example: 1 })
  @IsInt()
  cityId: number;

  @ApiPropertyOptional({
    example: 1,
    description: 'Escola existente (ou omitir e enviar sugestao).',
  })
  @IsOptional()
  @IsInt()
  schoolId?: number;

  @ApiPropertyOptional({ example: 'EEB Nova Escola' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  suggestedSchoolName?: string;
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
