import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { EspecificacaoDeGrafico, PassoDoAssistente, TrechoRecuperado } from '../chat.types';

export class CriarConversaDto {
  @ApiPropertyOptional({
    example: 'Desempenho por ODS em Rio do Sul',
    description: 'Opcional. Sem titulo, a conversa herda o texto da primeira pergunta.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  titulo?: string;
}

export class PerguntarDto {
  @ApiProperty({ example: 'Qual ODS tem a menor taxa de acerto?' })
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  pergunta: string;
}

export class ConversaDto {
  @ApiProperty({ example: '3f2b1c4e-...' })
  id: string;

  @ApiProperty({ example: 'Desempenho por ODS em Rio do Sul' })
  titulo: string;

  @ApiProperty()
  criadaEm: Date;

  @ApiProperty()
  atualizadaEm: Date;
}

export class MensagemDto {
  @ApiProperty({ example: 1 })
  id: number;

  @ApiProperty({ example: 'usuario', enum: ['usuario', 'assistente'] })
  papel: string;

  @ApiProperty()
  conteudo: string;

  @ApiPropertyOptional({
    description: 'Trechos recuperados e ferramentas acionadas. Null nas mensagens do usuario.',
  })
  passos?: PassoDoAssistente[] | null;

  @ApiPropertyOptional({
    description: 'Graficos montados a partir de consultas reais. Os numeros nunca vem do modelo.',
  })
  graficos?: EspecificacaoDeGrafico[] | null;

  @ApiProperty()
  criadaEm: Date;
}

export class RespostaDto {
  @ApiProperty({ type: MensagemDto })
  mensagem: MensagemDto;

  @ApiProperty({
    description: 'Trechos que sustentaram a resposta, para exibir as fontes na interface.',
  })
  trechosCitados: TrechoRecuperado[];
}

export class StatusDoChatDto {
  @ApiProperty({
    example: true,
    description: 'false quando OPENAI_API_KEY nao esta configurada.',
  })
  habilitado: boolean;

  @ApiProperty({ example: 42, description: 'Trechos indexados na base de conhecimento.' })
  trechosIndexados: number;

  @ApiProperty({ example: 'gpt-4o-mini' })
  modelo: string;
}
