import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsService } from '../../analytics/analytics.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { RegionLevel } from '../../dashboard/dto/region-level.enum';
import { FerramentasService } from './ferramentas.service';

describe('FerramentasService', () => {
  let service: FerramentasService;
  let dashboard: {
    overview: jest.Mock;
    byOds: jest.Mock;
    byRegion: jest.Mock;
    byQuestion: jest.Mock;
    coberturaPorOds: jest.Mock;
    coberturaGeografica: jest.Mock;
  };
  let analytics: {
    acertoPorOds: jest.Mock;
    desempenhoPorEscolaridade: jest.Mock;
    calibragemPerguntas: jest.Mock;
  };

  beforeEach(async () => {
    dashboard = {
      overview: jest.fn(() => Promise.resolve({ totalRespostas: 10 })),
      byOds: jest.fn(() => Promise.resolve([{ goalNumber: 6, taxa: 42 }])),
      byRegion: jest.fn(() => Promise.resolve([])),
      byQuestion: jest.fn(() => Promise.resolve([])),
      coberturaPorOds: jest.fn(() => Promise.resolve([])),
      coberturaGeografica: jest.fn(() => Promise.resolve([])),
    };
    analytics = {
      acertoPorOds: jest.fn(() => Promise.resolve([])),
      desempenhoPorEscolaridade: jest.fn(() => Promise.resolve([])),
      calibragemPerguntas: jest.fn(() => Promise.resolve([])),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FerramentasService,
        { provide: DashboardService, useValue: dashboard },
        { provide: AnalyticsService, useValue: analytics },
      ],
    }).compile();

    service = module.get(FerramentasService);
  });

  describe('declaracoes', () => {
    it('declara todas as ferramentas com nome unico', () => {
      const nomes = service.declaracoes.map((d) => d.function.name);
      expect(new Set(nomes).size).toBe(nomes.length);
      expect(nomes).toHaveLength(10);
    });

    it('toda ferramenta declarada tem descricao', () => {
      // Sem descricao o modelo nao sabe quando aciona-la.
      for (const declaracao of service.declaracoes) {
        expect(declaracao.function.description?.length ?? 0).toBeGreaterThan(20);
      }
    });

    it('toda ferramenta declarada tem case no switch', async () => {
      // Impede declarar uma ferramenta e esquecer de trata-la em executar().
      // gerar_grafico exige 'fonte' — chama-la sem argumento recusa por
      // validacao, nao por falta de case, entao o teste passa o minimo valido.
      const argumentosMinimos: Record<string, Record<string, unknown>> = {
        gerar_grafico: { fonte: 'desempenho_por_ods' },
      };

      for (const declaracao of service.declaracoes) {
        const nome = declaracao.function.name;
        await expect(service.executar(nome, argumentosMinimos[nome] ?? {})).resolves.not.toThrow();
      }
    });
  });

  describe('executar', () => {
    it('repassa os filtros recebidos do modelo', async () => {
      await service.executar('desempenho_por_ods', { goalNumber: 6, cityId: 1 });

      expect(dashboard.byOds).toHaveBeenCalledWith(
        expect.objectContaining({ goalNumber: 6, cityId: 1 }),
      );
    });

    it('converte filtro numerico que o modelo mandou como string', async () => {
      // O modelo as vezes manda "6" em vez de 6, apesar do schema.
      await service.executar('desempenho_por_ods', { goalNumber: '6' });

      expect(dashboard.byOds).toHaveBeenCalledWith(expect.objectContaining({ goalNumber: 6 }));
    });

    it('ignora filtro nao numerico em vez de propagar NaN', async () => {
      await service.executar('desempenho_por_ods', { goalNumber: 'seis' });

      expect(dashboard.byOds).toHaveBeenCalledWith(
        expect.objectContaining({ goalNumber: undefined }),
      );
    });

    it('usa estado como granularidade padrao de regiao', async () => {
      await service.executar('desempenho_por_regiao', {});

      expect(dashboard.byRegion).toHaveBeenCalledWith(expect.anything(), RegionLevel.STATE);
    });

    it('aceita a granularidade de regiao informada', async () => {
      await service.executar('desempenho_por_regiao', { level: 'city' });

      expect(dashboard.byRegion).toHaveBeenCalledWith(expect.anything(), RegionLevel.CITY);
    });

    it('cai no padrao quando a granularidade e invalida', async () => {
      await service.executar('desempenho_por_regiao', { level: 'planeta' });

      expect(dashboard.byRegion).toHaveBeenCalledWith(expect.anything(), RegionLevel.STATE);
    });

    it('cobertura geografica nao passa pelo recorte que omite quem nao participou', async () => {
      // desempenho_por_regiao parte de game_answer e omite quem tem zero —
      // usa-la para "onde a participacao nao chegou" devolve o oposto do pedido.
      await service.executar('cobertura_geografica', {});

      expect(dashboard.coberturaGeografica).toHaveBeenCalledWith(RegionLevel.SCHOOL);
      expect(dashboard.byRegion).not.toHaveBeenCalled();
    });

    it('cobertura geografica aceita o nivel cidade', async () => {
      await service.executar('cobertura_geografica', { level: 'city' });

      expect(dashboard.coberturaGeografica).toHaveBeenCalledWith(RegionLevel.CITY);
    });

    it('cobertura do catalogo nao passa por desempenho_por_ods', async () => {
      // desempenho_por_ods omite ODS sem nenhuma resposta — foi o que fez o
      // assistente negar que existisse ODS sem pergunta cadastrada.
      await service.executar('cobertura_do_catalogo', {});

      expect(dashboard.coberturaPorOds).toHaveBeenCalled();
      expect(dashboard.byOds).not.toHaveBeenCalled();
    });

    it('grafico executa a consulta real e devolve os dados junto', async () => {
      // O modelo escolhe a fonte; os numeros vem da consulta. Ele nunca informa
      // valor — e o que impede um grafico com dado inventado.
      dashboard.byOds.mockResolvedValue([
        { goalNumber: 6, goalName: 'Agua', taxaAcerto: 0.5, totalRespostas: 20 },
        { goalNumber: 7, goalName: 'Energia', taxaAcerto: 0.25, totalRespostas: 20 },
      ]);

      const retorno = (await service.executar('gerar_grafico', {
        fonte: 'desempenho_por_ods',
        titulo: 'Acerto por ODS',
      })) as { grafico: { tipo: string; itens: unknown[] }; dados: unknown[] };

      expect(dashboard.byOds).toHaveBeenCalled();
      expect(retorno.grafico.tipo).toBe('barras');
      expect(retorno.grafico.itens).toHaveLength(2);
      expect(retorno.dados).toHaveLength(2);
    });

    it('grafico rejeita fonte que nao e plotavel', async () => {
      await expect(service.executar('gerar_grafico', { fonte: 'visao_geral' })).rejects.toThrow(
        /nao pode virar grafico/i,
      );
    });

    it('grafico devolve motivo em vez de estourar quando nao se sustenta', async () => {
      // Serie zerada: o assistente deve explicar em texto, nao desenhar vazio.
      dashboard.byOds.mockResolvedValue([]);

      const retorno = (await service.executar('gerar_grafico', {
        fonte: 'desempenho_por_ods',
      })) as { grafico: null; motivo: string };

      expect(retorno.grafico).toBeNull();
      expect(retorno.motivo).toMatch(/nenhuma linha/i);
    });

    it('rejeita ferramenta desconhecida', async () => {
      await expect(service.executar('deletar_tudo', {})).rejects.toThrow(/desconhecida/i);
    });
  });

  describe('guard de LGPD', () => {
    it('remove campos pessoais do retorno antes de virar prompt', async () => {
      // Simula um refactor futuro que passe a expor dado individual num
      // servico agregado. Nada disso pode sair para a OpenAI.
      dashboard.overview.mockResolvedValue({
        totalRespostas: 10,
        email: 'aluno@escola.br',
        name: 'Maria',
        userId: 7,
      });

      const retorno = (await service.executar('visao_geral', {})) as Record<string, unknown>;

      expect(retorno.totalRespostas).toBe(10);
      expect(retorno).not.toHaveProperty('email');
      expect(retorno).not.toHaveProperty('name');
      expect(retorno).not.toHaveProperty('userId');
    });

    it('limpa campos pessoais dentro de arrays aninhados', async () => {
      dashboard.byOds.mockResolvedValue([
        { goalNumber: 6, taxa: 42, participantes: [{ nome: 'Joao', acertos: 3 }] },
      ]);

      const retorno = (await service.executar('desempenho_por_ods', {})) as Array<{
        participantes: Array<Record<string, unknown>>;
      }>;

      expect(retorno[0].participantes[0]).not.toHaveProperty('nome');
      expect(retorno[0].participantes[0].acertos).toBe(3);
    });

    it('preserva os campos agregados legitimos', async () => {
      const retorno = (await service.executar('desempenho_por_ods', {})) as Array<
        Record<string, unknown>
      >;

      expect(retorno).toEqual([{ goalNumber: 6, taxa: 42 }]);
    });
  });
});
