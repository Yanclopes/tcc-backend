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
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AppRole } from '../auth/role.enum';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { SetRoleDto } from './dto/set-role.dto';
import { UserDataExportDto } from './dto/user-data-export.dto';
import { AppUser } from './entities/app-user.entity';
import { UsersService } from './users.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Retorna o perfil do usuario autenticado' })
  me(@CurrentUser() user: JwtUser): Promise<AppUser> {
    return this.usersService.findById(user.userId);
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
