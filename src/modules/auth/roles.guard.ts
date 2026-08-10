import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtUser } from './current-user.decorator';
import { AppRole } from './role.enum';
import { ROLES_KEY } from './roles.decorator';

/**
 * Autoriza a rota conforme o papel presente no JWT. Deve rodar DEPOIS do
 * JwtAuthGuard (que popula req.user). Rotas sem @Roles sao liberadas por esta
 * guarda (o controle de autenticacao fica a cargo do JwtAuthGuard).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<AppRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest<{ user?: JwtUser }>().user;
    if (!user || !user.role) {
      throw new ForbiddenException('Acesso restrito: papel insuficiente.');
    }
    // Hierarquia: o master satisfaz qualquer exigencia de papel (super-admin).
    if (user.role === AppRole.MASTER) {
      return true;
    }
    if (!required.includes(user.role as AppRole)) {
      throw new ForbiddenException('Acesso restrito: papel insuficiente.');
    }
    return true;
  }
}
