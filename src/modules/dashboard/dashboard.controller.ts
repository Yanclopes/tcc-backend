import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRole } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DashboardService } from './dashboard.service';
import { DashboardFilterDto } from './dto/dashboard-filter.dto';
import {
  DashboardOverviewDto,
  OdsBreakdownRowDto,
  QuestionBreakdownRowDto,
  RegionBreakdownRowDto,
} from './dto/dashboard-responses.dto';
import { RegionLevel } from './dto/region-level.enum';

/**
 * Dashboard de analise de dados. Canal exclusivo do administrador para o
 * levantamento do conhecimento sobre os ODS — geral ou por regiao/escolaridade.
 */
@ApiTags('dashboard')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(AppRole.ADMIN)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @ApiOperation({ summary: 'KPIs gerais do levantamento (filtravel)' })
  overview(@Query() filter: DashboardFilterDto): Promise<DashboardOverviewDto> {
    return this.dashboardService.overview(filter);
  }

  @Get('by-ods')
  @ApiOperation({ summary: 'Desempenho por ODS (filtravel)' })
  byOds(@Query() filter: DashboardFilterDto): Promise<OdsBreakdownRowDto[]> {
    return this.dashboardService.byOds(filter);
  }

  @Get('by-region')
  @ApiOperation({
    summary: 'Desempenho por regiao (estado/cidade/escola) — apenas autenticados',
  })
  byRegion(@Query() filter: DashboardFilterDto): Promise<RegionBreakdownRowDto[]> {
    return this.dashboardService.byRegion(filter, filter.level ?? RegionLevel.STATE);
  }

  @Get('by-question')
  @ApiOperation({ summary: 'Desempenho por pergunta (filtravel)' })
  byQuestion(@Query() filter: DashboardFilterDto): Promise<QuestionBreakdownRowDto[]> {
    return this.dashboardService.byQuestion(filter);
  }
}
