import { ApiHideProperty, ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { City } from '../../geo/entities/city.entity';
import { School } from '../../geo/entities/school.entity';
import { State } from '../../geo/entities/state.entity';
import { EducationLevel } from './education-level.entity';
import { Role } from './role.entity';
import { UserConsent } from './user-consent.entity';

/**
 * 'user' e palavra reservada no PostgreSQL -> a tabela chama-se 'app_user'.
 */
@Entity('app_user')
export class AppUser {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Maria Silva' })
  @Column({ type: 'varchar' })
  name: string;

  @ApiProperty({ example: 'maria@escola.edu.br' })
  @Column({ type: 'varchar', unique: true })
  email: string;

  /**
   * Guarda APENAS o hash (bcrypt), nunca a senha em texto puro.
   * Nao selecionada por padrao para evitar vazamento acidental em respostas.
   */
  @ApiHideProperty()
  @Column({ type: 'varchar', select: false })
  password: string;

  @ManyToOne(() => School, (school) => school.users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'school' })
  school?: School | null;

  @ManyToOne(() => State, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'state' })
  state?: State | null;

  @ManyToOne(() => City, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'city' })
  city?: City | null;

  @ManyToOne(() => EducationLevel, (level) => level.users, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'education_level' })
  educationLevel: EducationLevel;

  /**
   * Marca que o aluno precisa refazer a escolha da escola no proximo login.
   * Setada quando uma sugestao dele foi rejeitada com motivo pelo admin.
   */
  @ApiProperty({ example: false })
  @Column({ name: 'needs_school_reregistration', type: 'boolean', default: false })
  needsSchoolReregistration: boolean;

  /** Motivo da ultima rejeicao de sugestao — mostrado ao aluno no re-registro. */
  @ApiProperty({ nullable: true })
  @Column({ name: 'school_rejection_reason', type: 'text', nullable: true })
  schoolRejectionReason?: string | null;

  @ManyToOne(() => Role, (role) => role.users, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'role' })
  role?: Role | null;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @OneToMany(() => UserConsent, (consent) => consent.user)
  consents: UserConsent[];
}
