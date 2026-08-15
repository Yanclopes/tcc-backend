import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AuditAction } from '../audit/audit-action.enum';
import { AuditService } from '../audit/audit.service';
import { City } from '../geo/entities/city.entity';
import { School } from '../geo/entities/school.entity';
import { AppUser } from '../users/entities/app-user.entity';
import { EducationLevel } from '../users/entities/education-level.entity';
import {
  ApproveSuggestionDto,
  CreateSchoolDto,
  CreateSchoolSuggestionDto,
  LinkSuggestionDto,
  RejectSuggestionDto,
  UpdateSchoolDto,
} from './dto/school.dto';
import { SchoolSuggestion, SuggestionStatus } from './entities/school-suggestion.entity';

@Injectable()
export class SchoolsService {
  constructor(
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
    @InjectRepository(City) private readonly cityRepo: Repository<City>,
    @InjectRepository(EducationLevel)
    private readonly levelRepo: Repository<EducationLevel>,
    @InjectRepository(SchoolSuggestion)
    private readonly suggestionRepo: Repository<SchoolSuggestion>,
    @InjectRepository(AppUser) private readonly userRepo: Repository<AppUser>,
    private readonly audit: AuditService,
  ) {}

  // ------------------------------------------------------------------
  // CRUD de escolas (admin)
  // ------------------------------------------------------------------
  findAll(cityId?: number): Promise<School[]> {
    return this.schoolRepo.find({
      where: cityId ? { city: { id: cityId } } : {},
      relations: { city: { state: true }, educationLevels: true },
      order: { name: 'ASC' },
    });
  }

  async findOne(id: number): Promise<School> {
    const school = await this.schoolRepo.findOne({
      where: { id },
      relations: { city: { state: true }, educationLevels: true },
    });
    if (!school) throw new NotFoundException(`Escola ${id} nao encontrada.`);
    return school;
  }

  async create(dto: CreateSchoolDto): Promise<School> {
    const city = await this.getCity(dto.cityId);
    const educationLevels = await this.getLevels(dto.educationLevelIds);
    const school = this.schoolRepo.create({ name: dto.name, city, educationLevels });
    await this.schoolRepo.save(school);
    return this.findOne(school.id);
  }

  async update(id: number, dto: UpdateSchoolDto): Promise<School> {
    const school = await this.findOne(id);
    if (dto.name !== undefined) school.name = dto.name;
    if (dto.cityId !== undefined) school.city = await this.getCity(dto.cityId);
    if (dto.educationLevelIds !== undefined) {
      school.educationLevels = await this.getLevels(dto.educationLevelIds);
    }
    await this.schoolRepo.save(school);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const school = await this.findOne(id);
    // O FK app_user.school e ON DELETE SET NULL: alunos ficam sem escola.
    await this.schoolRepo.remove(school);
  }

  // ------------------------------------------------------------------
  // Sugestoes de escola (aluno sugere, admin resolve)
  // ------------------------------------------------------------------
  async createSuggestion(
    dto: CreateSchoolSuggestionDto,
    userId: number | null,
  ): Promise<SchoolSuggestion> {
    const city = await this.getCity(dto.cityId);
    const suggestion = this.suggestionRepo.create({
      name: dto.name,
      city,
      note: dto.note ?? null,
      suggestedBy: userId ? ({ id: userId } as AppUser) : null,
      status: 'pending',
    });
    return this.suggestionRepo.save(suggestion);
  }

  listSuggestions(status?: SuggestionStatus): Promise<SchoolSuggestion[]> {
    return this.suggestionRepo.find({
      where: status ? { status } : {},
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Aprova a sugestao: cria a escola real e, se houver aluno vinculado, ajusta o
   * cadastro dele para apontar para a nova escola. Os dois lados ficam alinhados.
   */
  async approveSuggestion(
    id: number,
    dto: ApproveSuggestionDto,
    actorUserId: number,
  ): Promise<School> {
    const suggestion = await this.getSuggestion(id);
    if (suggestion.status !== 'pending') {
      throw new BadRequestException('Esta sugestao ja foi resolvida.');
    }

    const cityId = dto.cityId ?? suggestion.city.id;
    const school = await this.create({
      name: dto.name ?? suggestion.name,
      cityId,
      educationLevelIds: dto.educationLevelIds,
    });

    // Vincula o aluno que sugeriu a escola recem-criada.
    if (suggestion.suggestedBy) {
      await this.userRepo.update(
        { id: suggestion.suggestedBy.id },
        {
          school: { id: school.id } as School,
          needsSchoolReregistration: false,
          schoolRejectionReason: null,
        },
      );
    }

    suggestion.status = 'approved';
    suggestion.createdSchool = school;
    suggestion.resolvedAt = new Date();
    await this.suggestionRepo.save(suggestion);
    await this.audit.record({
      actorUserId,
      action: AuditAction.SCHOOL_SUGGESTION_APPROVED,
      targetType: 'school_suggestion',
      targetId: id,
      metadata: {
        createdSchoolId: school.id,
        suggestedByUserId: suggestion.suggestedBy?.id ?? null,
      },
    });
    return school;
  }

  /**
   * Vincula a sugestao a uma escola JA existente no catalogo. Cobre o caso em
   * que o aluno digitou o nome errado ou nao encontrou a escola na busca.
   * O aluno passa a apontar para a escola existente — NAO cria nova e NAO
   * penaliza o aluno com re-registro.
   */
  async linkSuggestionToExisting(
    id: number,
    dto: LinkSuggestionDto,
    actorUserId: number,
  ): Promise<School> {
    const suggestion = await this.getSuggestion(id);
    if (suggestion.status !== 'pending') {
      throw new BadRequestException('Esta sugestao ja foi resolvida.');
    }
    const school = await this.findOne(dto.schoolId);

    if (suggestion.suggestedBy) {
      await this.userRepo.update(
        { id: suggestion.suggestedBy.id },
        {
          school: { id: school.id } as School,
          needsSchoolReregistration: false,
          schoolRejectionReason: null,
        },
      );
    }

    suggestion.status = 'linked';
    suggestion.createdSchool = school;
    suggestion.resolvedAt = new Date();
    await this.suggestionRepo.save(suggestion);
    await this.audit.record({
      actorUserId,
      action: AuditAction.SCHOOL_SUGGESTION_LINKED,
      targetType: 'school_suggestion',
      targetId: id,
      metadata: {
        linkedSchoolId: school.id,
        suggestedByUserId: suggestion.suggestedBy?.id ?? null,
      },
    });
    return school;
  }

  /**
   * Rejeita a sugestao com um motivo. Se ha aluno vinculado, marca a flag de
   * re-registro forcado e persiste o motivo — o aluno vera no proximo login
   * e sera obrigado a refazer a escolha antes de qualquer outra acao.
   */
  async rejectSuggestion(
    id: number,
    dto: RejectSuggestionDto,
    actorUserId: number,
  ): Promise<SchoolSuggestion> {
    const suggestion = await this.getSuggestion(id);
    if (suggestion.status !== 'pending') {
      throw new BadRequestException('Esta sugestao ja foi resolvida.');
    }
    suggestion.status = 'rejected';
    suggestion.rejectionReason = dto.reason;
    suggestion.resolvedAt = new Date();
    const saved = await this.suggestionRepo.save(suggestion);

    if (suggestion.suggestedBy) {
      await this.userRepo.update(
        { id: suggestion.suggestedBy.id },
        { needsSchoolReregistration: true, schoolRejectionReason: dto.reason },
      );
    }

    await this.audit.record({
      actorUserId,
      action: AuditAction.SCHOOL_SUGGESTION_REJECTED,
      targetType: 'school_suggestion',
      targetId: id,
      metadata: {
        suggestedByUserId: suggestion.suggestedBy?.id ?? null,
        reason: dto.reason,
      },
    });
    return saved;
  }

  async countPendingSuggestions(): Promise<number> {
    return this.suggestionRepo.count({ where: { status: 'pending' } });
  }

  // ==================================================================
  private async getCity(cityId: number): Promise<City> {
    const city = await this.cityRepo.findOne({ where: { id: cityId } });
    if (!city) throw new NotFoundException(`Cidade ${cityId} nao encontrada.`);
    return city;
  }

  private async getLevels(ids: number[]): Promise<EducationLevel[]> {
    if (!ids || ids.length === 0) return [];
    const levels = await this.levelRepo.find({ where: { id: In(ids) } });
    if (levels.length !== ids.length) {
      throw new BadRequestException('Um ou mais niveis de escolaridade nao existem.');
    }
    return levels;
  }

  private async getSuggestion(id: number): Promise<SchoolSuggestion> {
    const suggestion = await this.suggestionRepo.findOne({ where: { id } });
    if (!suggestion) throw new NotFoundException(`Sugestao ${id} nao encontrada.`);
    return suggestion;
  }
}
