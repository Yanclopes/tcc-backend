import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { OpenAiService } from './openai.service';
import { RetrieverService } from './retriever.service';

/** Monta a linha bruta que o SQL devolve. */
function linha(id: number, fonte: string, similaridade: number) {
  return {
    trecho_id: id,
    documento_id: id,
    fonte,
    titulo: `Titulo ${id}`,
    texto: `Texto ${id}`,
    similaridade: String(similaridade),
  };
}

describe('RetrieverService', () => {
  let service: RetrieverService;
  let dataSource: { query: jest.Mock };

  /**
   * Responde as duas buscas (curada e do banco) conforme a condicao presente no
   * SQL, respeitando o LIMIT que o servico pediu.
   */
  function comCorpus(curados: ReturnType<typeof linha>[], doBanco: ReturnType<typeof linha>[]) {
    dataSource.query.mockImplementation((sql: string, params: unknown[]) => {
      const limite = Number(params[1]);
      const fonte = sql.includes("NOT LIKE 'curado:%'") ? doBanco : curados;
      return Promise.resolve(fonte.slice(0, limite));
    });
  }

  beforeEach(async () => {
    dataSource = { query: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetrieverService,
        { provide: getDataSourceToken(), useValue: dataSource },
        {
          provide: OpenAiService,
          useValue: {
            topK: 6,
            gerarEmbedding: jest.fn(() => Promise.resolve(new Array(1536).fill(0.1))),
          },
        },
      ],
    }).compile();

    service = module.get(RetrieverService);
  });

  it('reserva metade das vagas para a base curada', async () => {
    // Cenario medido em dev: os trechos do banco pontuam acima dos curados numa
    // pergunta metodologica. Sem reserva, a metodologia seria expulsa do topo —
    // e e justamente o que o assistente precisa acertar.
    comCorpus(
      [
        linha(1, 'curado:ressalvas', 0.5),
        linha(2, 'curado:metricas', 0.46),
        linha(3, 'curado:regras', 0.44),
      ],
      [
        linha(10, 'banco:question:1', 0.62),
        linha(11, 'banco:question:2', 0.61),
        linha(12, 'banco:question:3', 0.6),
        linha(13, 'banco:question:4', 0.59),
        linha(14, 'banco:question:5', 0.58),
        linha(15, 'banco:question:6', 0.57),
      ],
    );

    const trechos = await service.recuperar('pergunta metodologica');

    expect(trechos).toHaveLength(6);
    expect(trechos.filter((t) => t.fonte.startsWith('curado:'))).toHaveLength(3);
    expect(trechos.filter((t) => t.fonte.startsWith('banco:'))).toHaveLength(3);
  });

  it('devolve as vagas curadas ao banco quando nao ha curado relevante', async () => {
    comCorpus(
      [linha(1, 'curado:ressalvas', 0.2)], // abaixo do piso
      [
        linha(10, 'banco:question:1', 0.62),
        linha(11, 'banco:question:2', 0.61),
        linha(12, 'banco:question:3', 0.6),
        linha(13, 'banco:question:4', 0.59),
        linha(14, 'banco:question:5', 0.58),
        linha(15, 'banco:question:6', 0.57),
      ],
    );

    const trechos = await service.recuperar('pergunta sobre o catalogo');

    expect(trechos).toHaveLength(6);
    expect(trechos.every((t) => t.fonte.startsWith('banco:'))).toBe(true);
  });

  it('descarta tudo que fica abaixo do piso de similaridade', async () => {
    // Pergunta fora do escopo: melhor devolver nada e deixar o assistente dizer
    // que nao sabe do que entregar os trechos menos ruins do corpus.
    comCorpus([linha(1, 'curado:ressalvas', 0.25)], [linha(10, 'banco:question:1', 0.3)]);

    expect(await service.recuperar('qual a capital da Franca')).toEqual([]);
  });

  it('ordena o resultado por similaridade decrescente', async () => {
    comCorpus(
      [linha(1, 'curado:ressalvas', 0.9)],
      [linha(10, 'banco:question:1', 0.5), linha(11, 'banco:question:2', 0.7)],
    );

    const similaridades = (await service.recuperar('qualquer')).map((t) => t.similaridade);

    expect(similaridades).toEqual([...similaridades].sort((a, b) => b - a));
  });

  it('converte a similaridade textual do driver em numero', async () => {
    comCorpus([linha(1, 'curado:ressalvas', 0.5)], []);

    const [trecho] = await service.recuperar('qualquer');

    expect(typeof trecho.similaridade).toBe('number');
    expect(trecho.similaridade).toBeCloseTo(0.5);
  });

  it('respeita o topK informado pelo chamador', async () => {
    comCorpus(
      [linha(1, 'curado:a', 0.9)],
      [linha(10, 'banco:1', 0.8), linha(11, 'banco:2', 0.7), linha(12, 'banco:3', 0.6)],
    );

    expect(await service.recuperar('qualquer', 2)).toHaveLength(2);
  });
});
