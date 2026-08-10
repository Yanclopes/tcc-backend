import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'maria@escola.edu.br' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'senhaForte123' })
  @IsString()
  @MinLength(8)
  password: string;
}
