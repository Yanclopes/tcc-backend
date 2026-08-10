import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtUser } from './current-user.decorator';
import { AppRole } from './role.enum';
import { RolesGuard } from './roles.guard';

/** Cria um ExecutionContext falso com o req.user informado. */
function contextWith(user?: Partial<JwtUser>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => undefined,
    getClass: () => undefined,
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;
  let guard: RolesGuard;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it('libera rota sem @Roles', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextWith({ role: 'user' }))).toBe(true);
  });

  it('libera quando o papel do usuario e suficiente', () => {
    reflector.getAllAndOverride.mockReturnValue([AppRole.ADMIN]);
    expect(
      guard.canActivate(contextWith({ userId: 1, email: 'a@a.com', role: 'admin' })),
    ).toBe(true);
  });

  it('bloqueia quando o papel e insuficiente', () => {
    reflector.getAllAndOverride.mockReturnValue([AppRole.ADMIN]);
    expect(() => guard.canActivate(contextWith({ role: 'user' }))).toThrow(
      ForbiddenException,
    );
  });

  it('bloqueia quando nao ha usuario', () => {
    reflector.getAllAndOverride.mockReturnValue([AppRole.ADMIN]);
    expect(() => guard.canActivate(contextWith(undefined))).toThrow(ForbiddenException);
  });
});
