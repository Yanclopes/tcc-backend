import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { City } from './city.entity';
import { Country } from './country.entity';

@Entity('state')
export class State {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({ example: 'SC', description: 'Sigla de 2 letras' })
  @Column({ type: 'char', length: 2 })
  code: string;

  @ApiProperty({ example: 'Santa Catarina' })
  @Column({ type: 'varchar' })
  name: string;

  @ManyToOne(() => Country, (country) => country.states, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'country' })
  country: Country;

  @OneToMany(() => City, (city) => city.state)
  cities: City[];
}
