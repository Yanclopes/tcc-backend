import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** Formato do usuario anexado a requisicao apos validacao do JWT. */
export interface JwtUser {
  userId: number;
  email: string;
  role: string;
}

/**
 * Extrai o usuario autenticado (req.user) injetado pela JwtStrategy.
 * Uso: metodo(@CurrentUser() user: JwtUser).
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
