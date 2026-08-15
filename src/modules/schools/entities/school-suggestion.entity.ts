import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { City } from '../../geo/entities/city.entity';
import { School } from '../../geo/entities/school.entity';
import { AppUser } from '../../users/entities/app-user.entity';

export type SuggestionStatus = 'pending' | 'approved' | 'rejected' | 'linked';

/**
 * Sugestao de escola feita por um aluno no cadastro, quando a escola dele ainda
 * nao existe no sistema. O admin revisa, aprova (criando a School real) e o
 * aluno passa a apontar para ela — os dois lados trabalham juntos nesse ponto.
 */
@Entity('school_suggestion')
export class SchoolSuggestion {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Escola Municipal Sao Jose' })
  @Column({ type: 'varchar' })
  name: string;

  @ManyToOne(() => City, { onDelete: 'RESTRICT', eager: true })
  @JoinColumn({ name: 'city' })
  city: City;

  @ApiProperty({ example: 'Fica no bairro Centro', nullable: true })
  @Column({ type: 'varchar', nullable: true })
  note?: string | null;

  /** Aluno que sugeriu (para o admin ajustar o cadastro dele na aprovacao). */
  @ManyToOne(() => AppUser, { nullable: true, onDelete: 'SET NULL', eager: true })
  @JoinColumn({ name: 'suggested_by' })
  suggestedBy?: AppUser | null;

  @ApiProperty({ enum: ['pending', 'approved', 'rejected', 'linked'], example: 'pending' })
  @Column({ type: 'varchar', default: 'pending' })
  status: SuggestionStatus;

  /** Motivo informado pelo admin ao rejeitar (visivel ao aluno no re-registro). */
  @ApiProperty({ nullable: true })
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string | null;

  /** Escola criada a partir desta sugestao (preenchida na aprovacao). */
  @ManyToOne(() => School, { nullable: true, onDelete: 'SET NULL', eager: true })
  @JoinColumn({ name: 'created_school' })
  createdSchool?: School | null;

  @ApiProperty()
  @CreateDateColumn({ type: 'timestamp' })
  createdAt: Date;

  @ApiProperty({ nullable: true })
  @Column({ type: 'timestamp', nullable: true })
  resolvedAt?: Date | null;
}
