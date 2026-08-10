import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AppUser } from '../../users/entities/app-user.entity';
import { EducationLevel } from '../../users/entities/education-level.entity';
import { City } from './city.entity';

@Entity('school')
export class School {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'EEB Paulo Zimmermann' })
  @Column({ type: 'varchar' })
  name: string;

  @ManyToOne(() => City, (city) => city.schools, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'city' })
  city: City;

  /** Niveis de escolaridade que a escola atende (N:N). */
  @ManyToMany(() => EducationLevel, { cascade: false })
  @JoinTable({
    name: 'school_education_level',
    joinColumn: { name: 'school', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'education_level', referencedColumnName: 'id' },
  })
  educationLevels: EducationLevel[];

  @OneToMany(() => AppUser, (user) => user.school)
  users: AppUser[];
}
