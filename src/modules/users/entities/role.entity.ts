import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { AppUser } from './app-user.entity';

@Entity('role')
export class Role {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'student', description: 'Ex.: student, teacher, admin' })
  @Column({ type: 'varchar' })
  name: string;

  @OneToMany(() => AppUser, (user) => user.role)
  users: AppUser[];
}
