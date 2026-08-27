import { ApiProperty } from '@nestjs/swagger';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { ChatTrecho } from './chat-trecho.entity';

/**
 * Um documento da base de conhecimento do assistente.
 *
 * Vem de duas origens (ver tcc-docs/specs/06-chat-ia.md):
 *   - 'curado:*' — texto escrito para o assistente, em conhecimento/*.ts
 *   - 'banco:*'  — derivado do proprio banco (ODS, perguntas, catalogos)
 */
@Entity('chat_documento')
export class ChatDocumento {
  @ApiProperty({ example: 1 })
  @PrimaryGeneratedColumn()
  id: number;

  @ApiProperty({
    example: 'curado:metricas',
    description:
      'Identificador estavel da origem. E por ele que a reindexacao decide se ja existe.',
  })
  @Column({ type: 'varchar', length: 120 })
  fonte: string;

  @ApiProperty({ example: 'Metricas do levantamento' })
  @Column({ type: 'varchar', length: 200 })
  titulo: string;

  @ApiProperty({
    description:
      'sha256 do texto. Base da idempotencia: hash igual, nao reindexa (nao gasta embedding).',
  })
  @Column({ type: 'varchar', length: 64 })
  hash: string;

  @ApiProperty()
  @Column({ type: 'timestamp', name: 'indexado_em', default: () => 'now()' })
  indexadoEm: Date;

  @OneToMany(() => ChatTrecho, (trecho) => trecho.documento)
  trechos: ChatTrecho[];
}
