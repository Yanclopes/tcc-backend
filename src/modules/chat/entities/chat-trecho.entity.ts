import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ChatDocumento } from './chat-documento.entity';

/**
 * Um pedaco de documento, com seu embedding.
 *
 * NOTA IMPORTANTE: a coluna `embedding vector(1536)` NAO e mapeada aqui.
 * O TypeORM nao conhece o tipo `vector` do pgvector — ele nao sabe serializar
 * na escrita nem gerar o operador de distancia `<=>` na leitura. Por isso a
 * gravacao (IngestaoService) e a busca por similaridade (RetrieverService)
 * usam SQL cru com cast explicito `$1::vector`. Esta entidade cobre apenas as
 * colunas escalares, usadas nas leituras comuns.
 */
@Entity('chat_trecho')
export class ChatTrecho {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => ChatDocumento, (documento) => documento.trechos, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'documento' })
  documento: ChatDocumento;

  @Column({ type: 'int' })
  ordem: number;

  @Column({ type: 'text' })
  texto: string;

  @Column({ type: 'int', default: 0 })
  tokens: number;
}
