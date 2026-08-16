import { HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { BadRequestException } from '@nestjs/common';
import { RedisService } from '../../common/redis/redis.service';
import { AuditAction } from '../audit/audit-action.enum';
import { AuditService } from '../audit/audit.service';
import { SchoolsService } from '../schools/schools.service';
import { AppUser } from '../users/entities/app-user.entity';
import { UserConsent } from '../users/entities/user-consent.entity';
import { UsersService } from '../users/users.service';
import { DEFAULT_ROLE } from './role.enum';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './jwt.strategy';

// Bloqueio por e-mail apos N tentativas erradas.
// Complementa o rate limit por IP (que ja existe): a partir daqui, um atacante
// que troque de IP a cada tentativa ainda bate no mesmo balde por e-mail.
const LOGIN_FAIL_WINDOW_S = 15 * 60; // janela de contagem: 15 min
const LOGIN_FAIL_LIMIT = 5;
const LOGIN_LOCK_TTL_S = 30 * 60; // bloqueio: 30 min

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly schoolsService: SchoolsService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    @InjectRepository(UserConsent)
    private readonly consentRepository: Repository<UserConsent>,
  ) {}

  /** Registra um usuario, grava consentimento (se informado) e ja autentica. */
  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    if (dto.suggestedSchoolName && !dto.suggestedSchoolCityId) {
      throw new BadRequestException('Informe a cidade da escola sugerida (suggestedSchoolCityId).');
    }
    if (!dto.schoolId && !dto.suggestedSchoolName) {
      throw new BadRequestException(
        'Informe uma escola (schoolId) ou envie uma sugestao (suggestedSchoolName + suggestedSchoolCityId).',
      );
    }
    if (dto.schoolId && dto.suggestedSchoolName) {
      throw new BadRequestException(
        'Informe apenas UM: schoolId (escola existente) OU suggestedSchoolName (sugestao).',
      );
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
    const email = dto.email.toLowerCase();
    const lockKey = `auth:lock:${email}`;
    const failKey = `auth:fail:${email}`;

    if (await this.redis.exists(lockKey)) {
      const ttl = await this.redis.ttl(lockKey);
      const mins = Math.max(1, Math.ceil(ttl / 60));
      throw new HttpException(
        `Conta temporariamente bloqueada por excesso de tentativas. Tente novamente em ${mins} min.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.usersService.findByEmailWithPassword(dto.email);
    const passwordMatches = user ? await bcrypt.compare(dto.password, user.password) : false;

    if (!user || !passwordMatches) {
      const fails = await this.redis.incrWithTtl(failKey, LOGIN_FAIL_WINDOW_S);
      if (fails >= LOGIN_FAIL_LIMIT) {
        await this.redis.setJson(lockKey, { at: new Date().toISOString() }, LOGIN_LOCK_TTL_S);
        await this.redis.del(failKey);
        // Auditoria com userId opcional (pode ser nulo em ataque a e-mail inexistente).
        await this.audit.record({
          actorUserId: user?.id ?? null,
          action: AuditAction.USER_LOGIN_BLOCKED,
          targetType: 'app_user',
          targetId: user?.id ?? email,
          metadata: { email, fails, lockTtlSeconds: LOGIN_LOCK_TTL_S },
        });
      }
      throw new UnauthorizedException('Credenciais invalidas.');
    }

    // Login bem-sucedido: zera contador para nao punir tentativas antigas isoladas.
    await this.redis.del(failKey);
    return this.buildAuthResponse(user);
  }

  private async buildAuthResponse(user: AppUser): Promise<AuthResponseDto> {
    const role = user.role?.name ?? DEFAULT_ROLE;
    const payload: JwtPayload = { sub: user.id, email: user.email, role };
    const currentConsentVersion = process.env.PRIVACY_VERSION ?? '2026-01-v1';
    const lastConsent = await this.consentRepository.findOne({
      where: { user: { id: user.id } },
      order: { grantedAt: 'DESC' },
    });
    const needsConsentReacceptance = lastConsent?.consentVersion !== currentConsentVersion;
    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role,
        needsSchoolReregistration: user.needsSchoolReregistration ?? false,
        schoolRejectionReason: user.schoolRejectionReason ?? null,
        needsConsentReacceptance,
        currentConsentVersion,
      },
    };
  }
}
