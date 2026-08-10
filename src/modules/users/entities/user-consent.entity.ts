import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AppUser } from './app-user.entity';

/**
 * Registro de consentimento (LGPD). Mantem historico por versao do termo,
 * permitindo auditar qual versao cada usuario aceitou e quando.
 */
@Entity('user_consent')
export class UserConsent {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => AppUser, (user) => user.consents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user' })
  user: AppUser;

  @ApiProperty({ example: '2026-01-v1', description: 'Versao do termo aceito' })
  @Column({ type: 'varchar' })
  consentVersion: string;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp' })
  grantedAt: Date;
}
