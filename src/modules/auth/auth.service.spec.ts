import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcryptjs';
import { SchoolsService } from '../schools/schools.service';
import { UserConsent } from '../users/entities/user-consent.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<Pick<UsersService, 'create' | 'findByEmailWithPassword'>>;

  beforeEach(async () => {
    usersService = {
      create: jest.fn(),
      findByEmailWithPassword: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: SchoolsService, useValue: { createSuggestion: jest.fn() } },
        { provide: JwtService, useValue: { sign: jest.fn(() => 'signed.jwt.token') } },
        {
          provide: getRepositoryToken(UserConsent),
          useValue: { create: jest.fn((v) => v), save: jest.fn((v) => Promise.resolve(v)) },
        },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('login', () => {
    it('retorna token quando as credenciais sao validas', async () => {
      const passwordHash = await bcrypt.hash('senhaForte123', 10);
      usersService.findByEmailWithPassword.mockResolvedValue({
        id: 1,
        name: 'Maria',
        email: 'maria@escola.edu.br',
        password: passwordHash,
      } as never);

      const result = await service.login({
        email: 'maria@escola.edu.br',
        password: 'senhaForte123',
      });

      expect(result.accessToken).toBe('signed.jwt.token');
      expect(result.user).toEqual({
        id: 1,
        name: 'Maria',
        email: 'maria@escola.edu.br',
        role: 'user',
      });
    });

    it('rejeita quando o usuario nao existe', async () => {
      usersService.findByEmailWithPassword.mockResolvedValue(null);
      await expect(
        service.login({ email: 'x@y.com', password: 'senhaForte123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejeita quando a senha esta incorreta', async () => {
      const passwordHash = await bcrypt.hash('outraSenha', 10);
      usersService.findByEmailWithPassword.mockResolvedValue({
        id: 1,
        name: 'Maria',
        email: 'maria@escola.edu.br',
        password: passwordHash,
      } as never);

      await expect(
        service.login({ email: 'maria@escola.edu.br', password: 'senhaForte123' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
