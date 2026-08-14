import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AppUser } from '../../users/entities/app-user.entity';

/**
 * Trilha de auditoria de acoes sensiveis. Uma linha por evento; imutavel
 * (nenhum caminho da aplicacao faz UPDATE ou DELETE desta tabela).
 */
@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  /** Ator da acao. Nullable: se o proprio ator se excluiu, o log fica orfao mas preservado. */
  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: AppUser | null;

  @Column({ type: 'varchar' })
  action: string;

  @Column({ type: 'varchar', nullable: true })
  targetType?: string | null;

  @Column({ type: 'varchar', nullable: true })
  targetId?: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata?: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp', name: 'at' })
  at: Date;
}
