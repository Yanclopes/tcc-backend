import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { CreateUserDto } from '../../users/dto/create-user.dto';

export class RegisterDto extends CreateUserDto {
  @ApiPropertyOptional({
    example: '2026-01-v1',
    description:
      'Versao do termo de consentimento aceito (LGPD). Se informada, registra o consentimento.',
  })
  @IsOptional()
  @IsString()
  consentVersion?: string;

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
