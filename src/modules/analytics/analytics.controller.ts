import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRole } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AnalyticsService } from './analytics.service';
import { MvAcertoPorOds } from './entities/mv-acerto-por-ods.entity';
import { MvCalibragemPerguntas } from './entities/mv-calibragem-perguntas.entity';
import { MvDesempenhoPorEscolaridade } from './entities/mv-desempenho-por-escolaridade.entity';

/**
 * Camada analitica baseada nas materialized views (visao consolidada).
 * Todo o conteudo aqui integra o dashboard e e restrito a administradores.
 */
@ApiTags('analytics')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.ADMIN)
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('acerto-por-ods')
  @ApiOperation({ summary: 'Taxa de acerto agregada por ODS (admin)' })
  acertoPorOds(): Promise<MvAcertoPorOds[]> {
    return this.analyticsService.acertoPorOds();
  }

  @Get('desempenho-por-escolaridade')
  @ApiOperation({ summary: 'Acerto cruzando escolaridade x ODS (admin)' })
  desempenhoPorEscolaridade(): Promise<MvDesempenhoPorEscolaridade[]> {
    return this.analyticsService.desempenhoPorEscolaridade();
  }

  @Get('calibragem-perguntas')
  @ApiOperation({ summary: 'Perguntas por qualidade de calibragem (admin)' })
  @ApiQuery({
    name: 'flag',
    required: false,
    enum: ['muito_facil', 'muito_dificil', 'ok', 'amostra_insuficiente'],
  })
  calibragemPerguntas(@Query('flag') flag?: string): Promise<MvCalibragemPerguntas[]> {
    return this.analyticsService.calibragemPerguntas(flag);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Recalcula as materialized views (admin)' })
  refresh(): Promise<{ refreshed: string[] }> {
    return this.analyticsService.refreshAll();
  }
}
