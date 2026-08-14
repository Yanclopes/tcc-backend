import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

/**
 * Confirmacao para self-delete (direito ao esquecimento, LGPD art. 18, VI).
 * Exige a senha atual do usuario para impedir exclusao acidental (ou por sequestro
 * de sessao roubada) — o efeito e IRREVERSIVEL (cascata em game, ranking etc.).
 */
export class DeleteAccountDto {
  @ApiProperty({ example: 'minhaSenhaAtual', description: 'Senha atual para confirmar a exclusao' })
  @IsString()
  @MinLength(1)
  password: string;
}
