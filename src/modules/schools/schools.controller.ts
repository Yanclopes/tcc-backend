import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OptionalParseIntPipe } from '../../common/pipes/optional-parse-int.pipe';
import { CurrentUser, JwtUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { AppRole } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { School } from '../geo/entities/school.entity';
import {
  ApproveSuggestionDto,
  CreateSchoolDto,
  CreateSchoolSuggestionDto,
  UpdateSchoolDto,
} from './dto/school.dto';
import { SchoolSuggestion, SuggestionStatus } from './entities/school-suggestion.entity';
import { SchoolsService } from './schools.service';

@ApiTags('schools')
@Controller('schools')
export class SchoolsController {
  constructor(private readonly schoolsService: SchoolsService) {}

  // ----- Sugestoes (rotas estaticas ANTES de :id) -----
  @Post('suggestions')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Sugere uma escola inexistente (aluno). Vincula ao usuario se autenticado.',
  })
  suggest(
    @Body() dto: CreateSchoolSuggestionDto,
    @CurrentUser() user?: JwtUser,
  ): Promise<SchoolSuggestion> {
    return this.schoolsService.createSuggestion(dto, user?.userId ?? null);
  }

  @Get('suggestions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Lista sugestoes de escola (somente admin)' })
  @ApiQuery({ name: 'status', required: false, enum: ['pending', 'approved', 'rejected'] })
  listSuggestions(@Query('status') status?: SuggestionStatus): Promise<SchoolSuggestion[]> {
    return this.schoolsService.listSuggestions(status);
  }

  @Post('suggestions/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({
    summary: 'Aprova a sugestao: cria a escola e vincula o aluno (somente admin)',
  })
  approve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ApproveSuggestionDto,
    @CurrentUser() actor: JwtUser,
  ): Promise<School> {
    return this.schoolsService.approveSuggestion(id, dto, actor.userId);
  }

  @Post('suggestions/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Rejeita a sugestao de escola (somente admin)' })
  reject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() actor: JwtUser,
  ): Promise<SchoolSuggestion> {
    return this.schoolsService.rejectSuggestion(id, actor.userId);
  }

  // ----- CRUD de escolas -----
  @Get()
  @ApiOperation({ summary: 'Lista escolas (com cidade e niveis atendidos)' })
  @ApiQuery({ name: 'cityId', required: false, type: Number })
  findAll(@Query('cityId', OptionalParseIntPipe) cityId?: number): Promise<School[]> {
    return this.schoolsService.findAll(cityId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Retorna uma escola por id' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<School> {
    return this.schoolsService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Cadastra uma escola (somente admin)' })
  create(@Body() dto: CreateSchoolDto): Promise<School> {
    return this.schoolsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Atualiza uma escola (somente admin)' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateSchoolDto): Promise<School> {
    return this.schoolsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(AppRole.ADMIN)
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Remove uma escola (somente admin)' })
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.schoolsService.remove(id);
  }
}
