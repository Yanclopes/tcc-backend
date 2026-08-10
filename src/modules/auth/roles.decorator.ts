import { SetMetadata } from '@nestjs/common';
import { AppRole } from './role.enum';

export const ROLES_KEY = 'roles';

/**
 * Marca uma rota como restrita a determinados papeis.
 * Uso: @Roles(AppRole.ADMIN). Deve ser combinado com JwtAuthGuard + RolesGuard.
 */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
