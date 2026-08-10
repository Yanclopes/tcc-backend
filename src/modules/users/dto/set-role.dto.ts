import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { ASSIGNABLE_ROLES, AppRole } from '../../auth/role.enum';

export class SetRoleDto {
  @ApiProperty({
    enum: ASSIGNABLE_ROLES,
    example: AppRole.ADMIN,
    description: "Papel a atribuir. Apenas 'user' ou 'admin' (o papel 'master' e unico).",
  })
  @IsIn(ASSIGNABLE_ROLES as unknown as string[])
  role: AppRole;
}
