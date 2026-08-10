import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Guarda padrao: exige um JWT valido no header Authorization. */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
