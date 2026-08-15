import { ApiProperty } from '@nestjs/swagger';

export class AuthUserDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'Maria Silva' })
  name: string;

  @ApiProperty({ example: 'maria@escola.edu.br' })
  email: string;

  @ApiProperty({ example: 'user', enum: ['user', 'admin', 'master'] })
  role: string;

  @ApiProperty({
    example: false,
    description:
      'Quando true, a ultima sugestao de escola foi rejeitada e o aluno precisa ' +
      'refazer a escolha no proximo acesso antes de qualquer outra acao.',
  })
  needsSchoolReregistration: boolean;

  @ApiProperty({ nullable: true, example: null })
  schoolRejectionReason?: string | null;
}

export class AuthResponseDto {
  @ApiProperty({ description: 'Token JWT (Bearer) para as rotas protegidas' })
  accessToken: string;

  @ApiProperty({ type: AuthUserDto })
  user: AuthUserDto;
}
