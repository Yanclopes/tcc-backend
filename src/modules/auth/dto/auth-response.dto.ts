import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Maria Silva' })
  name: string;

  @ApiProperty({ example: 'maria@escola.edu.br' })
  email: string;

  @ApiProperty({ example: 'user', enum: ['user', 'admin'] })
  role: string;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Token JWT (Bearer) para as rotas protegidas' })
  accessToken: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}
