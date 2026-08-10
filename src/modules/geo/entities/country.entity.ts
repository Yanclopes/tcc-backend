import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { State } from './state.entity';

@Entity('country')
export class Country {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'Brasil' })
  @Column({ type: 'varchar' })
  name: string;

  @OneToMany(() => State, (state) => state.country)
  states: State[];
}
