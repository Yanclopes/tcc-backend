import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { In, Repository } from 'typeorm';
import { AuditAction } from '../audit/audit-action.enum';
import { AuditService } from '../audit/audit.service';
import { AppRole, DEFAULT_ROLE } from '../auth/role.enum';
import { GameAnswer } from '../game/entities/game-answer.entity';
import { Game } from '../game/entities/game.entity';
import { City } from '../geo/entities/city.entity';
import { State } from '../geo/entities/state.entity';
import { Ranking } from '../ranking/entities/ranking.entity';
import { SchoolSuggestion } from '../schools/entities/school-suggestion.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UserDataExportDto } from './dto/user-data-export.dto';
import { AppUser } from './entities/app-user.entity';
import { Role } from './entities/role.entity';
import { UserConsent } from './entities/user-consent.entity';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(AppUser)
    private readonly userRepository: Repository<AppUser>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
    @InjectRepository(UserConsent)
    private readonly consentRepository: Repository<UserConsent>,
    @InjectRepository(Game)
    private readonly gameRepository: Repository<Game>,
    @InjectRepository(GameAnswer)
    private readonly answerRepository: Repository<GameAnswer>,
    @InjectRepository(Ranking)
    private readonly rankingRepository: Repository<Ranking>,
    @InjectRepository(SchoolSuggestion)
    private readonly suggestionRepository: Repository<SchoolSuggestion>,
    private readonly audit: AuditService,
  ) {}

  /**
   * Cria um usuario com a senha ja hasheada (bcrypt) e papel padrao 'user'.
   * O papel NUNCA vem do cliente no cadastro publico — evita auto-elevacao a
   * admin. Promocao de papel so pela rota administrativa (setRole).
   */
  async create(dto: CreateUserDto): Promise<AppUser> {
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Ja existe um usuario com este e-mail.');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);
    const role = await this.getRoleByName(DEFAULT_ROLE);

    const user = this.userRepository.create({
      name: dto.name,
      email: dto.email,
      password: passwordHash,
      school: dto.schoolId ? ({ id: dto.schoolId } as AppUser['school']) : null,
      state: { id: dto.stateId } as State,
      city: { id: dto.cityId } as City,
      educationLevel: { id: dto.educationLevelId } as AppUser['educationLevel'],
      role,
    });

    return this.userRepository.save(user);
  }

  /**
   * Atualiza os dados regionais do proprio usuario. Usado tanto no fluxo comum
   * de perfil quanto no re-registro forcado apos rejeicao de sugestao — nesse
   * caso limpa a flag e o motivo apos a atualizacao.
   */
  async updateOwnRegion(
    userId: number,
    input: { stateId: number; cityId: number; schoolId?: number | null },
  ): Promise<AppUser> {
    const user = await this.findById(userId);
    user.state = { id: input.stateId } as State;
    user.city = { id: input.cityId } as City;
    user.school = input.schoolId != null ? ({ id: input.schoolId } as AppUser['school']) : null;
    user.needsSchoolReregistration = false;
    user.schoolRejectionReason = null;
    await this.userRepository.save(user);
    return this.findById(userId);
  }

  /** Marca o aluno para re-registro forcado, guardando o motivo da rejeicao. */
  async flagForSchoolReregistration(userId: number, reason: string): Promise<void> {
    await this.userRepository.update(
      { id: userId },
      { needsSchoolReregistration: true, schoolRejectionReason: reason },
    );
  }

  /** Busca por e-mail com hash de senha E papel (para login/JWT). */
  async findByEmailWithPassword(email: string): Promise<AppUser | null> {
    return this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.email = :email', { email })
      .getOne();
  }

  async findById(id: number): Promise<AppUser> {
    const user = await this.userRepository.findOne({
      where: { id },
      relations: {
        school: true,
        state: true,
        city: { state: true },
        educationLevel: true,
        role: true,
      },
    });
    if (!user) {
      throw new NotFoundException(`Usuario ${id} nao encontrado.`);
    }
    return user;
  }

  /** Lista usuarios (uso administrativo). */
  findAll(): Promise<AppUser[]> {
    return this.userRepository.find({
      relations: {
        role: true,
        school: true,
        state: true,
        city: { state: true },
        educationLevel: true,
      },
      order: { id: 'ASC' },
    });
  }

  /** Altera o papel de um usuario (somente master; nao mexe em outro master). */
  async setRole(userId: number, roleName: AppRole, actorUserId: number): Promise<AppUser> {
    const user = await this.findById(userId);
    if (user.role?.name === AppRole.MASTER) {
      throw new BadRequestException('O papel master nao pode ser alterado.');
    }
    const previousRole = user.role?.name ?? null;
    user.role = await this.getRoleByName(roleName);
    const saved = await this.userRepository.save(user);
    await this.audit.record({
      actorUserId,
      action: AuditAction.USER_ROLE_CHANGED,
      targetType: 'app_user',
      targetId: userId,
      metadata: { previousRole, newRole: roleName },
    });
    return saved;
  }

  // ------------------------------------------------------------------
  // LGPD — portabilidade (exportacao de dados) e direito ao esquecimento
  // ------------------------------------------------------------------

  /**
   * Reune TODO o dado pessoal do usuario em um payload serializavel — atende
   * ao direito de portabilidade previsto na LGPD (art. 18, V).
   */
  async exportUserData(userId: number): Promise<UserDataExportDto> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
      relations: { school: true, educationLevel: true, role: true },
    });
    if (!user) throw new NotFoundException(`Usuario ${userId} nao encontrado.`);

    const consents = await this.consentRepository.find({
      where: { user: { id: userId } },
      order: { grantedAt: 'ASC' },
    });

    const games = await this.gameRepository.find({
      where: { user: { id: userId } },
      relations: { difficulty: true, status: true },
      order: { createdAt: 'ASC' },
    });

    const gameIds = games.map((g) => g.id);
    const answers = gameIds.length
      ? await this.answerRepository.find({
          where: { game: { id: In(gameIds) } },
          relations: { question: { goal: true }, option: true, powerupUsed: true, game: true },
          order: { sequence: 'ASC' },
        })
      : [];

    const rankings = await this.rankingRepository.find({
      where: { user: { id: userId } },
      relations: { game: true },
      order: { completedAt: 'ASC' },
    });

    const suggestions = await this.suggestionRepository.find({
      where: { suggestedBy: { id: userId } },
      order: { createdAt: 'ASC' },
    });

    const payload: UserDataExportDto = {
      exportedAt: new Date().toISOString(),
      disclaimer:
        'Este arquivo contem todos os dados pessoais que a plataforma Desafio ODS armazena sobre voce, ' +
        'exportados a seu pedido em conformidade com a LGPD (art. 18, V).',
      profile: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role?.name ?? null,
        school: user.school ? { id: user.school.id, name: user.school.name } : null,
        educationLevel: user.educationLevel
          ? { id: user.educationLevel.id, name: user.educationLevel.name }
          : null,
        createdAt: user.createdAt.toISOString(),
      },
      consents: consents.map((c) => ({
        consentVersion: c.consentVersion,
        grantedAt: c.grantedAt.toISOString(),
      })),
      games: games.map((g) => ({
        id: g.id,
        difficultyId: g.difficulty?.id ?? null,
        status: g.status?.label ?? null,
        score: g.currentScore,
        streak: g.currentStreak,
        createdAt: g.createdAt.toISOString(),
        finishedAt: g.finishedAt ? g.finishedAt.toISOString() : null,
        answers: answers
          .filter((a) => a.game.id === g.id)
          .map((a) => ({
            questionId: a.question ? (a.question as unknown as { id: number }).id : 0,
            goalNumber: a.question?.goal?.number ?? null,
            chosenOptionId: a.option ? (a.option as unknown as { id: number }).id : null,
            isCorrect: a.isCorrect,
            responseTimeMs: a.responseTimeMs ?? null,
            sequence: a.sequence,
            powerupUsed: a.powerupUsed?.name ?? null,
            answeredAt: a.answeredAt.toISOString(),
          })),
      })),
      rankings: rankings.map((r) => ({
        id: r.id,
        gameId: r.game.id,
        score: r.score,
        completedAt: r.completedAt.toISOString(),
      })),
      schoolSuggestions: suggestions.map((s) => ({
        id: s.id,
        name: s.name,
        status: s.status,
        createdAt: s.createdAt.toISOString(),
        resolvedAt: s.resolvedAt ? s.resolvedAt.toISOString() : null,
      })),
    };

    await this.audit.record({
      actorUserId: userId,
      action: AuditAction.USER_DATA_EXPORTED,
      targetType: 'app_user',
      targetId: userId,
    });

    return payload;
  }

  /**
   * Exclui a propria conta (self-delete). Exige a senha atual para confirmar
   * — impede exclusao acidental ou por token vazado. A cascata do banco
   * remove game, ranking e demais dados relacionados.
   */
  async deleteSelf(userId: number, password: string): Promise<void> {
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .leftJoinAndSelect('user.role', 'role')
      .where('user.id = :userId', { userId })
      .getOne();
    if (!user) throw new NotFoundException(`Usuario ${userId} nao encontrado.`);

    if (user.role?.name === AppRole.MASTER) {
      throw new BadRequestException(
        'O usuario master nao pode se auto-excluir. Transfira o papel antes.',
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      throw new UnauthorizedException('Senha incorreta.');
    }

    // Audit ANTES do delete para preservar o registro com o user_id preenchido
    // (apos o delete, o ON DELETE SET NULL zera esse campo, mas a linha permanece).
    await this.audit.record({
      actorUserId: userId,
      action: AuditAction.USER_SELF_DELETED,
      targetType: 'app_user',
      targetId: userId,
      metadata: { email: user.email },
    });

    await this.userRepository.delete({ id: userId });
  }

  private async getRoleByName(name: string): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { name } });
    if (!role) {
      throw new BadRequestException(`Papel '${name}' ausente. Rode a seed (npm run seed).`);
    }
    return role;
  }
}
