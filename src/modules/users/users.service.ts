import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { Repository } from 'typeorm';
import { AppRole, DEFAULT_ROLE } from '../auth/role.enum';
import { CreateUserDto } from './dto/create-user.dto';
import { AppUser } from './entities/app-user.entity';
import { Role } from './entities/role.entity';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(AppUser)
    private readonly userRepository: Repository<AppUser>,
    @InjectRepository(Role)
    private readonly roleRepository: Repository<Role>,
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
      educationLevel: dto.educationLevelId
        ? ({ id: dto.educationLevelId } as AppUser['educationLevel'])
        : null,
      role,
    });

    return this.userRepository.save(user);
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
      relations: { school: true, educationLevel: true, role: true },
    });
    if (!user) {
      throw new NotFoundException(`Usuario ${id} nao encontrado.`);
    }
    return user;
  }

  /** Lista usuarios (uso administrativo). */
  findAll(): Promise<AppUser[]> {
    return this.userRepository.find({
      relations: { role: true, school: true, educationLevel: true },
      order: { id: 'ASC' },
    });
  }

  /** Altera o papel de um usuario (somente master; nao mexe em outro master). */
  async setRole(userId: number, roleName: AppRole): Promise<AppUser> {
    const user = await this.findById(userId);
    if (user.role?.name === AppRole.MASTER) {
      throw new BadRequestException('O papel master nao pode ser alterado.');
    }
    user.role = await this.getRoleByName(roleName);
    return this.userRepository.save(user);
  }

  private async getRoleByName(name: string): Promise<Role> {
    const role = await this.roleRepository.findOne({ where: { name } });
    if (!role) {
      throw new BadRequestException(
        `Papel '${name}' ausente. Rode a seed (npm run seed).`,
      );
    }
    return role;
  }
}
