import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AppUser } from './app-user.entity';

@Entity('education_level')
export class EducationLevel {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Ensino Fundamental II' })
  @Column({ type: 'varchar' })
  name: string;

  @OneToMany(() => AppUser, (user) => user.educationLevel)
  users: AppUser[];
}
