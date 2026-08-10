import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { School } from './school.entity';
import { State } from './state.entity';

@Entity('city')
export class City {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Rio do Sul' })
  @Column({ type: 'varchar' })
  name: string;

  @ManyToOne(() => State, (state) => state.cities, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'state' })
  state: State;

  @OneToMany(() => School, (school) => school.city)
  schools: School[];
}
