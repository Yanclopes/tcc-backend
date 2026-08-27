import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Goal } from '../../goals/entities/goal.entity';
import { Question } from '../../questions/entities/question.entity';
import { DocumentoDeConhecimento } from '../chat.types';
import { BASE_CURADA } from '../conhecimento';
import { ChatDocumento } from '../entities/chat-documento.entity';
import { estimarTokens, fatiar } from './chunking';
import { OpenAiService } from './openai.service';

/** Quantos trechos por chamada de embedding. A API aceita lote. */
const TAMANHO_DO_LOTE = 64;

export interface ResultadoDaIndexacao {
  documentosLidos: number;
  documentosIndexados: number;
  documentosInalterados: number;
  documentosRemovidos: number;
  trechosGravados: number;
  tokensEstimados: number;
}

/**
 * Monta o corpus e o indexa. Ver tcc-docs/specs/06-chat-ia.md.
 *
 * Idempotente por hash: documento cujo texto nao mudou nao e reindexado, o que
 * significa nao gastar embedding a toa. Rodar duas vezes seguidas custa zero na
 * segunda.
 */
@Injectable()
export class IngestaoService {
  private readonly logger = new Logger(IngestaoService.name);

  constructor(
    @InjectRepository(ChatDocumento)
    private readonly documentoRepo: Repository<ChatDocumento>,
    @InjectRepository(Goal)
    private readonly goalRepo: Repository<Goal>,
    @InjectRepository(Question)
    private readonly questionRepo: Repository<Question>,
    private readonly openai: OpenAiService,
    private readonly dataSource: DataSource,
  ) {}

  // ------------------------------------------------------------------
  // Montagem do corpus
  // ------------------------------------------------------------------

  /**
   * Fonte B: o proprio banco. Diferente da base curada, isto muda sozinho
   * conforme o catalogo cresce — e o motivo pelo qual busca vetorial se
   * justifica neste projeto.
   */
  private async corpusDoBanco(): Promise<DocumentoDeConhecimento[]> {
    const documentos: DocumentoDeConhecimento[] = [];

    const ods = await this.goalRepo.find({ order: { number: 'ASC' } });
    if (ods.length > 0) {
      documentos.push({
        fonte: 'banco:ods',
        titulo: 'Os 17 Objetivos de Desenvolvimento Sustentavel',
        texto: [
          '# Objetivos de Desenvolvimento Sustentavel cadastrados',
          '',
          'Lista canonica usada pela plataforma. As regras de negocio referenciam',
          'sempre o numero do ODS, nunca o id da tabela.',
          '',
          ...ods.map((o) => `- ODS ${o.number}: ${o.name}`),
        ].join('\n'),
      });
    }

    // Perguntas: uma por documento, para que a busca vetorial consiga apontar
    // a pergunta especifica em vez de um bloco com todas.
    const perguntas = await this.questionRepo.find({
      relations: { goal: true, options: true },
      order: { id: 'ASC' },
    });
    for (const q of perguntas) {
      const alternativas = (q.options ?? [])
        .map((o) => `- ${o.text}${o.id === q.answerOptionId ? '  <- correta' : ''}`)
        .join('\n');

      documentos.push({
        fonte: `banco:question:${q.id}`,
        titulo: `Pergunta ${q.id} — ODS ${q.goal?.number ?? '?'}`,
        texto: [
          `# Pergunta ${q.id}`,
          '',
          `ODS: ${q.goal?.number ?? '?'} — ${q.goal?.name ?? 'sem ODS'}`,
          `Dificuldade: ${q.difficulty ?? 'nao informada'}`,
          `Ativa: ${q.isActive ? 'sim' : 'nao'}`,
          '',
          '## Enunciado',
          '',
          q.text,
          '',
          '## Alternativas',
          '',
          alternativas || '(sem alternativas cadastradas)',
        ].join('\n'),
      });
    }

    return documentos;
  }

  private async montarCorpus(): Promise<DocumentoDeConhecimento[]> {
    return [...BASE_CURADA, ...(await this.corpusDoBanco())];
  }

  // ------------------------------------------------------------------
  // Indexacao
  // ------------------------------------------------------------------
  async indexar(): Promise<ResultadoDaIndexacao> {
    const corpus = await this.montarCorpus();
    const resultado: ResultadoDaIndexacao = {
      documentosLidos: corpus.length,
      documentosIndexados: 0,
      documentosInalterados: 0,
      documentosRemovidos: 0,
      trechosGravados: 0,
      tokensEstimados: 0,
    };

    for (const documento of corpus) {
      const hash = createHash('sha256').update(documento.texto).digest('hex');
      const existente = await this.documentoRepo.findOne({ where: { fonte: documento.fonte } });

      if (existente?.hash === hash) {
        resultado.documentosInalterados += 1;
        continue;
      }

      const trechos = fatiar(documento.titulo, documento.texto);
      if (trechos.length === 0) {
        this.logger.warn(`Documento '${documento.fonte}' nao produziu nenhum trecho; ignorado.`);
        continue;
      }

      const embeddings = await this.gerarEmLotes(trechos.map((t) => t.texto));

      // Documento e trechos vao numa transacao: um documento com embedding
      // pela metade e pior que um documento nao indexado.
      await this.dataSource.transaction(async (manager) => {
        let documentoId: number;

        if (existente) {
          // Os trechos antigos somem por ON DELETE CASCADE ao apagar e recriar,
          // mas aqui atualizamos no lugar para preservar o id do documento.
          await manager.query(`DELETE FROM "chat_trecho" WHERE "documento" = $1`, [existente.id]);
          await manager.query(
            `UPDATE "chat_documento" SET "titulo" = $1, "hash" = $2, "indexado_em" = now() WHERE "id" = $3`,
            [documento.titulo, hash, existente.id],
          );
          documentoId = existente.id;
        } else {
          const [linha] = (await manager.query(
            `INSERT INTO "chat_documento" ("fonte", "titulo", "hash") VALUES ($1, $2, $3) RETURNING "id"`,
            [documento.fonte, documento.titulo, hash],
          )) as Array<{ id: number }>;
          documentoId = linha.id;
        }

        for (let i = 0; i < trechos.length; i += 1) {
          const tokens = estimarTokens(trechos[i].texto);
          resultado.tokensEstimados += tokens;
          // O cast explicito ::vector e obrigatorio: o driver manda o array
          // como texto e o Postgres nao converte para vector implicitamente.
          await manager.query(
            `INSERT INTO "chat_trecho" ("documento", "ordem", "texto", "embedding", "tokens")
             VALUES ($1, $2, $3, $4::vector, $5)`,
            [
              documentoId,
              trechos[i].ordem,
              trechos[i].texto,
              this.vetorParaSql(embeddings[i]),
              tokens,
            ],
          );
        }
      });

      resultado.documentosIndexados += 1;
      resultado.trechosGravados += trechos.length;
      this.logger.log(`Indexado '${documento.fonte}' (${trechos.length} trechos).`);
    }

    resultado.documentosRemovidos = await this.removerOrfaos(corpus.map((d) => d.fonte));
    return resultado;
  }

  /**
   * Apaga do indice o que saiu do corpus — pergunta desativada e removida do
   * banco, documento curado renomeado. Sem isso o assistente continuaria
   * citando material que nao existe mais.
   */
  private async removerOrfaos(fontesAtuais: string[]): Promise<number> {
    if (fontesAtuais.length === 0) return 0;
    const resultado = (await this.documentoRepo
      .createQueryBuilder()
      .delete()
      .where('fonte NOT IN (:...fontes)', { fontes: fontesAtuais })
      .execute()) as { affected?: number | null };
    return resultado.affected ?? 0;
  }

  private async gerarEmLotes(textos: string[]): Promise<number[][]> {
    const todos: number[][] = [];
    for (let i = 0; i < textos.length; i += TAMANHO_DO_LOTE) {
      todos.push(...(await this.openai.gerarEmbeddings(textos.slice(i, i + TAMANHO_DO_LOTE))));
    }
    return todos;
  }

  /** pgvector aceita o literal no formato '[0.1,0.2,...]'. */
  private vetorParaSql(embedding: number[]): string {
    return `[${embedding.join(',')}]`;
  }
}
