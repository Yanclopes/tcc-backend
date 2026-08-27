import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuditAction } from '../audit/audit-action.enum';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, JwtUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRole } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { SchoolsService } from '../schools/schools.service';
import { UpdateOwnSchoolDto } from '../schools/dto/school.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { SetRoleDto } from './dto/set-role.dto';
import { UserDataExportDto } from './dto/user-data-export.dto';
import { AppUser } from './entities/app-user.entity';
import { UsersService } from './users.service';
import { PRIVACY_VERSION_ATUAL } from './privacy-version';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly schoolsService: SchoolsService,
    private readonly audit: AuditService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Retorna o perfil do usuario autenticado' })
  me(@CurrentUser() user: JwtUser): Promise<AppUser> {
    return this.usersService.findById(user.userId);
  }

  @Post('me/consent')
  @ApiOperation({
    summary: 'Aceita a versao vigente do termo LGPD (reconsentimento).',
    description:
      'Grava uma nova linha em user_consent com a versao atual (PRIVACY_VERSION do servidor). ' +
      'O historico anterior e preservado. Auditado como user.consent_reaccepted.',
  })
  async acceptConsent(@CurrentUser() user: JwtUser): Promise<{ consentVersion: string }> {
    const currentConsentVersion = PRIVACY_VERSION_ATUAL;
    await this.usersService.acceptConsent(user.userId, currentConsentVersion);
    await this.audit.record({
      actorUserId: user.userId,
      action: AuditAction.USER_CONSENT_REACCEPTED,
      targetType: 'app_user',
      targetId: user.userId,
      metadata: { consentVersion: currentConsentVersion },
    });
    return { consentVersion: currentConsentVersion };
  }

  @Patch('me/school')
  @ApiOperation({
    summary: 'Atualiza estado/cidade/escola do proprio usuario (usado no completar-perfil)',
    description:
      'Aceita schoolId (escola existente) OU suggestedSchoolName (nova sugestao). ' +
      'Limpa a flag needsSchoolReregistration ao concluir. Sugestoes rejeitadas ' +
      'anteriormente NAO sao apagadas — a auditoria preserva o historico.',
  })
  async updateOwnSchool(
    @CurrentUser() user: JwtUser,
    @Body() dto: UpdateOwnSchoolDto,
  ): Promise<AppUser> {
    if (!dto.schoolId && !dto.suggestedSchoolName) {
      throw new Error('Informe schoolId ou suggestedSchoolName.');
    }
    if (dto.schoolId && dto.suggestedSchoolName) {
      throw new Error('Informe apenas UM: schoolId OU suggestedSchoolName.');
    }
    const updated = await this.usersService.updateOwnRegion(user.userId, {
      stateId: dto.stateId,
      cityId: dto.cityId,
      schoolId: dto.schoolId ?? null,
    });
    if (dto.suggestedSchoolName) {
      await this.schoolsService.createSuggestion(
        { name: dto.suggestedSchoolName, cityId: dto.cityId },
        user.userId,
      );
    }
    await this.audit.record({
      actorUserId: user.userId,
      action: AuditAction.USER_SCHOOL_UPDATED,
      targetType: 'app_user',
      targetId: user.userId,
      metadata: {
        stateId: dto.stateId,
        cityId: dto.cityId,
        schoolId: dto.schoolId ?? null,
        suggestion: dto.suggestedSchoolName ?? null,
      },
    });
    return updated;
  }

  @Get('me/export')
  @Header('Content-Disposition', 'attachment; filename="desafio-ods-meus-dados.json"')
  @ApiOperation({
    summary: 'Baixa TODOS os dados pessoais do usuario (portabilidade LGPD)',
    description:
      'Retorna um JSON com perfil, consentimentos, partidas, respostas, ranking e sugestoes ' +
      'de escola. Content-Disposition attachment: o navegador salva como arquivo.',
  })
  exportMe(@CurrentUser() user: JwtUser): Promise<UserDataExportDto> {
    return this.usersService.exportUserData(user.userId);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Exclui a propria conta (direito ao esquecimento LGPD)',
    description:
      'Exige a senha atual para confirmar. A exclusao e IRREVERSIVEL: apaga usuario, ' +
      'partidas, respostas, rankings e sugestoes vinculadas (cascata do banco).',
  })
  deleteMe(@CurrentUser() user: JwtUser, @Body() dto: DeleteAccountDto): Promise<void> {
    return this.usersService.deleteSelf(user.userId, dto.password);
  }

  @Post('me/anonymize')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Anonimiza a propria conta (LGPD L3 — alternativa ao esquecimento)',
    description:
      'Exige a senha atual. Substitui nome, e-mail e senha por valores anonimos e bloqueia ' +
      'login futuro. Preserva estado, cidade, escola, escolaridade e a coleta bruta ' +
      '(partidas, respostas, ranking) como amostra anonima da pesquisa. IRREVERSIVEL.',
  })
  anonymizeMe(@CurrentUser() user: JwtUser, @Body() dto: DeleteAccountDto): Promise<void> {
    return this.usersService.anonymizeSelf(user.userId, dto.password);
  }

  @Get()
  @Roles(AppRole.ADMIN)
  @ApiOperation({ summary: 'Lista usuarios (somente admin)' })
  findAll(): Promise<AppUser[]> {
    return this.usersService.findAll();
  }

  @Get(':id')
  @Roles(AppRole.ADMIN)
  @ApiOperation({ summary: 'Retorna um usuario por id (somente admin)' })
  findOne(@Param('id', ParseIntPipe) id: number): Promise<AppUser> {
    return this.usersService.findById(id);
  }

  @Patch(':id/role')
  @Roles(AppRole.MASTER)
  @ApiOperation({
    summary: 'Concede ou revoga o papel admin de um usuario (somente master)',
    description:
      'Apenas o papel master pode alterar papeis. O alvo so pode virar "user" ou "admin"; ' +
      'o papel "master" e unico e nao e atribuivel pela API.',
  })
  setRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SetRoleDto,
    @CurrentUser() actor: JwtUser,
  ): Promise<AppUser> {
    return this.usersService.setRole(id, dto.role, actor.userId);
  }
}
