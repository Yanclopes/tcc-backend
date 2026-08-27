import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { TrechoRecuperado } from '../chat.types';
import { OpenAiService } from './openai.service';

/**
 * Similaridade minima para um trecho ser considerado relevante.
 *
 * Sem esse piso, uma pergunta fora do escopo ("qual a capital da Franca")
 * recupera os 6 trechos menos ruins do corpus e o modelo tenta responder com
 * eles. Com o piso, a recuperacao volta vazia e o assistente diz que nao sabe —
 * que e a resposta correta.
 *
 * O valor 0,35 saiu de medicao, nao de chute: perguntas dentro do escopo
 * recuperam entre 0,46 e 0,64; uma pergunta fora do escopo ("qual a capital da
 * Franca") recuperou 0,25. O piso fica na folga entre as duas faixas.
 */
const SIMILARIDADE_MINIMA = 0.35;

interface LinhaBruta {
  trecho_id: number;
  documento_id: number;
  fonte: string;
  titulo: string;
  texto: string;
  similaridade: string;
}

/** Busca vetorial sobre a base de conhecimento. */
@Injectable()
export class RetrieverService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly openai: OpenAiService,
  ) {}

  /**
   * Recupera os trechos mais proximos da pergunta.
   *
   * O SQL e cru de proposito: o TypeORM nao conhece o operador `<=>` do
   * pgvector nem o tipo `vector`. Ver a nota na entidade ChatTrecho.
   *
   * `<=>` e distancia de cosseno em [0, 2]; `1 - distancia` devolve a
   * similaridade em [-1, 1], que para embeddings normalizados fica em [0, 1].
   *
   * A busca e feita em DUAS FAIXAS, com vagas reservadas para a base curada.
   * Motivo medido: numa pergunta metodologica ("por que nao posso generalizar"),
   * uma busca unica trouxe quatro trechos de perguntas do banco antes do
   * documento de ressalvas. Com 20 perguntas cadastradas o conteudo curado
   * ainda cabia no topo; com algumas centenas seria expulso — e e justamente a
   * metodologia que o assistente precisa acertar. Reservar metade das vagas
   * mantem as duas fontes representadas independentemente do tamanho do
   * catalogo.
   */
  async recuperar(pergunta: string, topK?: number): Promise<TrechoRecuperado[]> {
    const limite = topK ?? this.openai.topK;
    const embedding = await this.openai.gerarEmbedding(pergunta);
    const vetor = `[${embedding.join(',')}]`;

    const vagasCuradas = Math.max(1, Math.floor(limite / 2));
    const [curados, doBanco] = await Promise.all([
      this.buscar(vetor, vagasCuradas, 'd."fonte" LIKE \'curado:%\''),
      this.buscar(vetor, limite, 'd."fonte" NOT LIKE \'curado:%\''),
    ]);

    const relevante = (t: TrechoRecuperado) => t.similaridade >= SIMILARIDADE_MINIMA;

    // A reserva so vale se NAO houver um corte global por similaridade depois:
    // os trechos curados perderiam as vagas para os do banco, que e exatamente
    // o que a reserva existe para impedir. Entao cada faixa e cortada no seu
    // proprio limite, e so depois as duas sao unidas.
    const escolhidosCurados = curados.filter(relevante);
    const vagasRestantes = limite - escolhidosCurados.length;
    const escolhidosDoBanco = doBanco.filter(relevante).slice(0, vagasRestantes);

    // Ordenar aqui e so apresentacao — a selecao ja esta fechada. Trecho curado
    // que nao passou do piso devolve a vaga para a outra faixa.
    return [...escolhidosCurados, ...escolhidosDoBanco].sort(
      (a, b) => b.similaridade - a.similaridade,
    );
  }

  private async buscar(
    vetor: string,
    limite: number,
    condicao: string,
  ): Promise<TrechoRecuperado[]> {
    const linhas: LinhaBruta[] = await this.dataSource.query(
      `SELECT t."id"            AS trecho_id,
              d."id"            AS documento_id,
              d."fonte"         AS fonte,
              d."titulo"        AS titulo,
              t."texto"         AS texto,
              1 - (t."embedding" <=> $1::vector) AS similaridade
         FROM "chat_trecho" t
         JOIN "chat_documento" d ON d."id" = t."documento"
        WHERE ${condicao}
        ORDER BY t."embedding" <=> $1::vector
        LIMIT $2`,
      [vetor, limite],
    );

    return linhas.map((linha) => ({
      trechoId: Number(linha.trecho_id),
      documentoId: Number(linha.documento_id),
      fonte: linha.fonte,
      titulo: linha.titulo,
      texto: linha.texto,
      similaridade: Number(linha.similaridade),
    }));
  }

  /** Quantos trechos existem hoje. Usado no health-check do modulo. */
  async contarTrechos(): Promise<number> {
    const [linha] = (await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM "chat_trecho"`,
    )) as Array<{ total: number }>;
    return linha?.total ?? 0;
  }
}
