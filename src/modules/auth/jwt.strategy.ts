import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtConfig } from '../../config/configuration';
import { JwtUser } from './current-user.decorator';

/** Payload assinado dentro do token JWT. */
export interface JwtPayload {
  sub: number;
  email: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const jwtConfig = config.get<JwtConfig>('jwt')!;
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig.secret,
    });
  }

  // O retorno vira req.user. Validacao da assinatura ja foi feita pelo passport.
  validate(payload: JwtPayload): JwtUser {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
