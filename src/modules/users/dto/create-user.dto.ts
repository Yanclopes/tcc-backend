import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Maria Silva' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiProperty({ example: 'maria@escola.edu.br' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senhaForte123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72) // limite do bcrypt
  password: string;

  // Estado e cidade sao obrigatorios: sustentam o recorte regional previsto
  // pela pesquisa mesmo quando a escola ainda esta em fase de sugestao.
  @ApiProperty({ example: 1, description: 'Id do estado (obrigatorio)' })
  @IsInt()
  stateId: number;

  @ApiProperty({ example: 1, description: 'Id da cidade (obrigatoria; deve pertencer ao estado)' })
  @IsInt()
  cityId: number;

  @ApiPropertyOptional({
    example: 1,
    description:
      'Id da escola. No cadastro, ou informar schoolId, ou informar uma sugestao ' +
      '(suggestedSchoolName + suggestedSchoolCityId). Pelo menos um dos dois e exigido.',
  })
  @IsOptional()
  @IsInt()
  schoolId?: number;

  // Escolaridade e obrigatoria: sustenta o recorte por segmento educacional
  // previsto na pesquisa.
  @ApiProperty({ example: 2, description: 'Id do nivel de escolaridade (obrigatorio)' })
  @IsInt()
  educationLevelId: number;

  // Observacao: o papel (role) NAO e aceito no cadastro publico. Todo novo
  // usuario nasce como 'user'; a promocao a 'admin' e feita por um admin.
}
