import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guarda opcional: se houver JWT valido, popula req.user; se nao houver (ou for
 * invalido), deixa passar como anonimo. Essencial para permitir partidas
 * anonimas — que ampliam a amostra da pesquisa — sem bloquear o endpoint.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  // Nunca lanca: usuario ausente/invalido simplesmente resulta em req.user = undefined.
  handleRequest<TUser>(_err: unknown, user: TUser): TUser {
    return user;
  }
}
