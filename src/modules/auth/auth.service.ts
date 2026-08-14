import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { SchoolsService } from '../schools/schools.service';
import { AppUser } from '../users/entities/app-user.entity';
import { UserConsent } from '../users/entities/user-consent.entity';
import { UsersService } from '../users/users.service';
import { DEFAULT_ROLE } from './role.enum';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly schoolsService: SchoolsService,
    @InjectRepository(UserConsent)
    private readonly consentRepository: Repository<UserConsent>,
  ) {}

  /** Registra um usuario, grava consentimento (se informado) e ja autentica. */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    if (dto.suggestedSchoolName && !dto.suggestedSchoolCityId) {
      throw new BadRequestException('Informe a cidade da escola sugerida (suggestedSchoolCityId).');
    }

    const user = await this.usersService.create(dto);

    if (dto.consentVersion) {
      await this.consentRepository.save(
        this.consentRepository.create({
          user: { id: user.id } as AppUser,
          consentVersion: dto.consentVersion,
        }),
      );
    }

    // Aluno indicou uma escola inexistente: registra sugestao para o admin.
    if (dto.suggestedSchoolName && dto.suggestedSchoolCityId) {
      await this.schoolsService.createSuggestion(
        { name: dto.suggestedSchoolName, cityId: dto.suggestedSchoolCityId },
        user.id,
      );
    }

    return this.buildAuthResponse(user);
  }

  /** Valida credenciais e retorna o token. Mensagem generica evita enumerar e-mails. */
  async login(dto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.usersService.findByEmailWithPassword(dto.email);
    if (!user) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    return this.buildAuthResponse(user);
  }

  private buildAuthResponse(user: AppUser): AuthResponseDto {
    const role = user.role?.name ?? DEFAULT_ROLE;
    const payload: JwtPayload = { sub: user.id, email: user.email, role };
    return {
      accessToken: this.jwtService.sign(payload),
      user: { id: user.id, name: user.name, email: user.email, role },
    };
  }
}
