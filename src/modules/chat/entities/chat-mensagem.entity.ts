import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AcaoProposta, EspecificacaoDeGrafico, PassoDoAssistente } from '../chat.types';
import { ChatConversa } from './chat-conversa.entity';

export const PAPEL_USUARIO = 'usuario';
export const PAPEL_ASSISTENTE = 'assistente';

/** Uma mensagem dentro de uma conversa. */
@Entity('chat_mensagem')
export class ChatMensagem {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ChatConversa, (conversa) => conversa.mensagens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversa' })
  conversa: ChatConversa;

  @ApiProperty({ example: PAPEL_USUARIO, enum: [PAPEL_USUARIO, PAPEL_ASSISTENTE] })
  @Column({ type: 'varchar', length: 20 })
  papel: string;

  @ApiProperty()
  @Column({ type: 'text' })
  conteudo: string;

  @ApiProperty({
    description:
      'Trechos recuperados e ferramentas acionadas para produzir a resposta. ' +
      'E o que da transparencia ao RAG na interface — e o que sustenta a analise no artigo.',
    nullable: true,
  })
  @Column({ type: 'jsonb', nullable: true })
  passos?: PassoDoAssistente[] | null;

  @ApiProperty({
    description:
      'Graficos montados a partir de consultas reais. Os numeros aqui NUNCA vem do modelo ' +
      '— ver .specs/06-chat-ia.md secao "Graficos".',
    nullable: true,
  })
  @Column({ type: 'jsonb', nullable: true })
  graficos?: EspecificacaoDeGrafico[] | null;

  @ApiProperty({
    description:
      'Acoes administrativas PROPOSTAS — nunca executadas pelo assistente. A execucao depende ' +
      'do clique do administrador. Ver .specs/06-chat-ia.md secao "Acoes administrativas".',
    nullable: true,
  })
  @Column({ type: 'jsonb', nullable: true })
  acoes?: AcaoProposta[] | null;

  @ApiProperty({
    description:
      'Respostas rapidas oferecidas ao fim da mensagem. Sao texto pre-preenchido: clicar ' +
      'envia a frase como pergunta. Nao executam nada.',
    nullable: true,
  })
  @Column({ type: 'jsonb', nullable: true })
  sugestoes?: string[] | null;

  @ApiProperty({ example: 1820 })
  @Column({ type: 'int', name: 'tokens_prompt', default: 0 })
  tokensPrompt: number;

  @ApiProperty({ example: 240 })
  @Column({ type: 'int', name: 'tokens_saida', default: 0 })
  tokensSaida: number;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp', name: 'criada_em' })
  criadaEm: Date;
}
