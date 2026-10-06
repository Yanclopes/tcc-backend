import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CreateUserDto } from '../../users/dto/create-user.dto';

export class RegisterDto extends CreateUserDto {
  // Obrigatorio: o consentimento e a BASE LEGAL declarada no termo (art. 7, I).
  // Enquanto era opcional, a API aceitava criar conta sem nenhum registro de
  // aceite — o formulario exigia a caixa marcada, mas qualquer chamada direta
  // contornava isso, e a conta nascia sem a base legal que a sustenta.
  @ApiProperty({
    example: '2026-10-v2',
    description:
      'Versao do termo de consentimento aceito (LGPD). Obrigatoria: sem ela nao ha base legal para o tratamento.',
  })
  @IsString()
  @IsNotEmpty()
  consentVersion!: string;

  @ApiPropertyOptional({
    example: 'Escola Municipal Sao Jose',
    description:
      'Nome de uma escola inexistente sugerida pelo aluno. Gera uma sugestao para o admin ' +
      'revisar; requer suggestedSchoolCityId. Nao definir schoolId em conjunto.',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  suggestedSchoolName?: string;

  @ApiPropertyOptional({
    example: 1,
    description: 'Cidade da escola sugerida (obrigatorio quando suggestedSchoolName e informado).',
  })
  @IsOptional()
  @IsInt()
  suggestedSchoolCityId?: number;
}
