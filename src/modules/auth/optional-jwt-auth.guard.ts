import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Guarda opcional: se houver JWT valido, popula req.user; se nao houver (ou for
 * invalido), deixa passar como anonimo. Uso pontual em endpoints publicos que
 * ainda assim se beneficiam de saber quem e o usuario quando logado (ex.:
 * sugestao de escola no cadastro — sem login vira sugestao "orfa").
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
