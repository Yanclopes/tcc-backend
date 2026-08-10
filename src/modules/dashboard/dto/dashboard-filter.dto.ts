import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { RegionLevel } from './region-level.enum';

/**
 * Filtros do dashboard. Todos opcionais e combináveis. Os filtros de regiao
 * (estado/cidade/escola) e de escolaridade implicam participantes AUTENTICADOS,
 * pois a partida anonima nao possui vinculo geografico/escolar.
 */
export class DashboardFilterDto {
  @ApiPropertyOptional({ example: 13, description: 'Numero canonico do ODS (1-17)' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(17)
  goalNumber?: number;

  @ApiPropertyOptional({ example: 1, description: 'Id do estado (recorte regional)' })
  @IsOptional()
  @IsInt()
  stateId?: number;

  @ApiPropertyOptional({ example: 1, description: 'Id da cidade (recorte regional)' })
  @IsOptional()
  @IsInt()
  cityId?: number;

  @ApiPropertyOptional({ example: 1, description: 'Id da escola (recorte regional)' })
  @IsOptional()
  @IsInt()
  schoolId?: number;

  @ApiPropertyOptional({ example: 3, description: 'Id do nivel de escolaridade' })
  @IsOptional()
  @IsInt()
  educationLevelId?: number;

  @ApiPropertyOptional({ example: '2026-01-01', description: 'Data inicial (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Data final (ISO 8601)' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({
    example: true,
    default: true,
    description:
      'Inclui partidas anonimas nas estatisticas gerais. Ignorado quando ha filtro regional/escolar.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  includeAnonymous?: boolean = true;

  @ApiPropertyOptional({
    enum: RegionLevel,
    default: RegionLevel.STATE,
    description: 'Granularidade do recorte regional (usado apenas em /by-region).',
  })
  @IsOptional()
  @IsEnum(RegionLevel)
  level?: RegionLevel;
}
