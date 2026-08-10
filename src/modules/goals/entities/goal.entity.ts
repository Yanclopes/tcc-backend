import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { Question } from '../../questions/entities/question.entity';

/**
 * Objetivo de Desenvolvimento Sustentavel (ODS).
 */
@Entity('goal')
export class Goal {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 4,
    description: 'Numero canonico do ODS (1 a 17). NAO confiar no id autoincrement.',
  })
  @Column({ type: 'int' })
  number: number;

  @ApiProperty({ example: 'Educacao de Qualidade' })
  @Column({ type: 'varchar' })
  name: string;

  @ApiProperty({ example: '#C5192D', description: 'Cor oficial do ODS (uso no front-end)' })
  @Column({ type: 'varchar' })
  color: string;

  @OneToMany(() => Question, (question) => question.goal)
  questions: Question[];
}
