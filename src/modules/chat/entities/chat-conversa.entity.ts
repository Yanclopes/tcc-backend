import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AppUser } from '../../users/entities/app-user.entity';
import { ChatMensagem } from './chat-mensagem.entity';

/** Uma conversa do assistente de analise. Pertence sempre a um usuario admin. */
@Entity('chat_conversa')
export class ChatConversa {
  @ApiProperty({ example: '3f2b1c4e-...' })
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => AppUser, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'usuario' })
  usuario: AppUser;

  @ApiProperty({
    example: 'Desempenho por ODS em Rio do Sul',
    description: 'Derivado da primeira pergunta, so para listar na lateral.',
  })
  @Column({ type: 'varchar', length: 200 })
  titulo: string;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp', name: 'criada_em' })
  criadaEm: Date;

  @ApiProperty()
  @UpdateDateColumn({ type: 'timestamp', name: 'atualizada_em' })
  atualizadaEm: Date;

  @OneToMany(() => ChatMensagem, (mensagem) => mensagem.conversa)
  mensagens: ChatMensagem[];
}
