import { GraficoIndisponivelError, MAXIMO_DE_BARRAS, montarGrafico } from './graficos';

/** Linha no formato que DashboardService.byOds devolve. */
function linhaOds(goalNumber: number, taxaAcerto: number, totalRespostas = 20) {
  return { goalNumber, goalName: `ODS ${goalNumber}`, taxaAcerto, totalRespostas };
}

describe('montarGrafico', () => {
  describe('fontes e metricas', () => {
    it('recusa fonte que nao esta no catalogo de plotaveis', () => {
      // A lista e fechada de proposito: e o que pode ir para o eixo.
      expect(() =>
        montarGrafico({ fonte: 'select_arbitrario', linhas: [linhaOds(1, 0.5)] }),
      ).toThrow(GraficoIndisponivelError);
    });

    it('cai na metrica padrao quando a pedida nao existe para a fonte', () => {
      const g = montarGrafico({
        fonte: 'desempenho_por_ods',
        linhas: [linhaOds(1, 0.5), linhaOds(2, 0.25)],
        metrica: 'tempo', // desempenho_por_ods nao tem 'tempo'
      });

      expect(g.formato).toBe('percentual');
    });

    it('usa a metrica pedida quando ela existe', () => {
      const g = montarGrafico({
        fonte: 'desempenho_por_ods',
        linhas: [linhaOds(1, 0.5, 30), linhaOds(2, 0.25, 10)],
        metrica: 'respostas',
      });

      expect(g.formato).toBe('contagem');
      expect(g.itens[0].valor).toBe(30);
    });
  });

  describe('valores', () => {
    it('converte taxa 0..1 em percentual', () => {
      const g = montarGrafico({
        fonte: 'desempenho_por_ods',
        linhas: [linhaOds(1, 0.4783), linhaOds(2, 0.25)],
      });

      expect(g.itens[0].valor).toBeCloseTo(47.83);
    });

    it('ordena por valor decrescente', () => {
      const g = montarGrafico({
        fonte: 'desempenho_por_ods',
        linhas: [linhaOds(1, 0.25), linhaOds(2, 0.9), linhaOds(3, 0.5)],
      });

      expect(g.itens.map((i) => i.valor)).toEqual([90, 50, 25]);
    });

    it('normaliza a proporcao pelo maior valor da serie', () => {
      const g = montarGrafico({
        fonte: 'desempenho_por_ods',
        linhas: [linhaOds(1, 0.8), linhaOds(2, 0.4)],
      });

      expect(g.itens[0].proporcao).toBe(1);
      expect(g.itens[1].proporcao).toBeCloseTo(0.5);
    });

    it('traz o N como detalhe de cada barra', () => {
      // Barra comprida sobre 3 respostas parece solida e nao e.
      const g = montarGrafico({
        fonte: 'desempenho_por_ods',
        linhas: [linhaOds(1, 0.8, 3), linhaOds(2, 0.4, 40)],
      });

      expect(g.itens[0].detalhe).toBe('3 respostas');
    });
  });

  describe('forma', () => {
    it('devolve indicador, e nao barra, para uma linha so', () => {
      // Grafico de uma barra e ruido: o numero e o grafico.
      const g = montarGrafico({ fonte: 'desempenho_por_ods', linhas: [linhaOds(6, 0.5)] });

      expect(g.tipo).toBe('indicador');
      expect(g.itens).toHaveLength(1);
    });

    it('devolve barras para varias linhas', () => {
      const g = montarGrafico({
        fonte: 'desempenho_por_ods',
        linhas: [linhaOds(1, 0.5), linhaOds(2, 0.3)],
      });

      expect(g.tipo).toBe('barras');
    });

    it('corta em MAXIMO_DE_BARRAS e avisa na nota', () => {
      const linhas = Array.from({ length: MAXIMO_DE_BARRAS + 5 }, (_, i) =>
        linhaOds(i + 1, (i + 1) / 100),
      );

      const g = montarGrafico({ fonte: 'desempenho_por_ods', linhas });

      expect(g.itens).toHaveLength(MAXIMO_DE_BARRAS);
      expect(g.nota).toContain(`${MAXIMO_DE_BARRAS} maiores`);
    });
  });

  describe('recusas', () => {
    it('recusa consulta sem nenhuma linha', () => {
      expect(() => montarGrafico({ fonte: 'desempenho_por_ods', linhas: [] })).toThrow(
        GraficoIndisponivelError,
      );
    });

    it('recusa retorno que nao e lista', () => {
      expect(() => montarGrafico({ fonte: 'desempenho_por_ods', linhas: { taxa: 1 } })).toThrow(
        GraficoIndisponivelError,
      );
    });

    it('recusa serie inteiramente zerada', () => {
      // 37 barras de zero nao comunicam nada; o texto comunica.
      expect(() =>
        montarGrafico({
          fonte: 'cobertura_geografica',
          linhas: [
            { escola: 'A', respostas: 0, alunosCadastrados: 0 },
            { escola: 'B', respostas: 0, alunosCadastrados: 0 },
          ],
        }),
      ).toThrow(/zero/i);
    });
  });

  describe('ressalvas', () => {
    it('avisa quando ha itens com amostra pequena', () => {
      const g = montarGrafico({
        fonte: 'desempenho_por_ods',
        linhas: [linhaOds(1, 0.9, 4), linhaOds(2, 0.5, 100)],
      });

      expect(g.nota).toMatch(/menos de 10 respostas/);
    });

    it('nao avisa amostra pequena em grafico de contagem', () => {
      // A ressalva e sobre percentual instavel; contagem nao tem esse problema.
      const g = montarGrafico({
        fonte: 'cobertura_do_catalogo',
        linhas: [
          { goalNumber: 1, goalName: 'A', perguntasCadastradas: 3, perguntasComResposta: 1 },
          { goalNumber: 2, goalName: 'B', perguntasCadastradas: 1, perguntasComResposta: 0 },
        ],
      });

      expect(g.nota).toBeUndefined();
    });
  });

  describe('matriz (heatmap)', () => {
    const cruzamento = [
      { educationLevelName: 'Ensino Medio', goalNumber: 2, taxaAcerto: 0.7, totalRespostas: 10 },
      { educationLevelName: 'Ensino Medio', goalNumber: 10, taxaAcerto: 0.4, totalRespostas: 20 },
      { educationLevelName: 'Ensino Superior', goalNumber: 2, taxaAcerto: 0.5, totalRespostas: 30 },
    ];

    it('monta celulas com os dois eixos', () => {
      const g = montarGrafico({
        fonte: 'desempenho_por_escolaridade',
        linhas: cruzamento,
        forma: 'matriz',
      });

      expect(g.tipo).toBe('matriz');
      expect(g.celulas).toHaveLength(3);
      expect(g.linhas).toEqual(['Ensino Medio', 'Ensino Superior']);
    });

    it('ordena as colunas pelo numero do ODS, nao alfabeticamente', () => {
      // Ordem alfabetica poria "ODS 10" antes de "ODS 2".
      const g = montarGrafico({
        fonte: 'desempenho_por_escolaridade',
        linhas: cruzamento,
        forma: 'matriz',
      });

      expect(g.colunas).toEqual(['ODS 2', 'ODS 10']);
    });

    it('normaliza a intensidade pelo maior valor da matriz', () => {
      const g = montarGrafico({
        fonte: 'desempenho_por_escolaridade',
        linhas: cruzamento,
        forma: 'matriz',
      });

      const maior = g.celulas?.find((c) => c.valor === 70);
      expect(maior?.intensidade).toBe(1);
    });

    it('avisa quantos cruzamentos ficaram sem dado', () => {
      // 2 linhas x 2 colunas = 4 celulas possiveis, 3 preenchidas.
      const g = montarGrafico({
        fonte: 'desempenho_por_escolaridade',
        linhas: cruzamento,
        forma: 'matriz',
      });

      expect(g.nota).toMatch(/1 cruzamento\(s\) sem nenhuma resposta/);
    });

    it('recusa matriz para fonte de uma dimensao so', () => {
      expect(() =>
        montarGrafico({ fonte: 'desempenho_por_ods', linhas: [linhaOds(1, 0.5)], forma: 'matriz' }),
      ).toThrow(/nao tem duas dimensoes/i);
    });
  });

  describe('barras agrupadas', () => {
    const cobertura = [
      { goalNumber: 4, goalName: 'Educacao', perguntasCadastradas: 3, perguntasComResposta: 3 },
      { goalNumber: 3, goalName: 'Saude', perguntasCadastradas: 0, perguntasComResposta: 0 },
    ];

    it('monta duas series com a mesma unidade', () => {
      const g = montarGrafico({
        fonte: 'cobertura_do_catalogo',
        linhas: cobertura,
        forma: 'barras_agrupadas',
      });

      expect(g.tipo).toBe('barras_agrupadas');
      expect(g.series).toHaveLength(2);
      expect(g.series?.[0].valores).toEqual([3, 0]);
    });

    it('alinha os valores das series com a ordem das categorias', () => {
      const g = montarGrafico({
        fonte: 'cobertura_do_catalogo',
        linhas: cobertura,
        forma: 'barras_agrupadas',
      });

      expect(g.itens[0].rotulo).toBe('ODS 4');
      expect(g.series?.[1].valores[0]).toBe(3);
    });

    it('recusa quando as duas series estao zeradas', () => {
      expect(() =>
        montarGrafico({
          fonte: 'cobertura_do_catalogo',
          linhas: [{ goalNumber: 3, perguntasCadastradas: 0, perguntasComResposta: 0 }],
          forma: 'barras_agrupadas',
        }),
      ).toThrow(/zerad/i);
    });

    it('recusa agrupamento para fonte sem duas medidas comparaveis', () => {
      expect(() =>
        montarGrafico({
          fonte: 'desempenho_por_regiao',
          linhas: [{ regionLabel: 'A', taxaAcerto: 0.5, totalRespostas: 10 }],
          forma: 'barras_agrupadas',
        }),
      ).toThrow(/nao tem duas medidas/i);
    });

    it('recusa agrupar medidas de unidades diferentes', () => {
      // alunos cadastrados x respostas: escalas que diferem por ordens de
      // grandeza. Lado a lado no mesmo eixo, a barra menor some.
      expect(() =>
        montarGrafico({
          fonte: 'cobertura_geografica',
          linhas: [{ escola: 'UNIDAVI', alunosCadastrados: 2, respostas: 67 }],
          forma: 'barras_agrupadas',
        }),
      ).toThrow(/nao tem duas medidas/i);
    });
  });

  describe('cor', () => {
    it('usa a cor oficial da ONU quando a categoria e um ODS', () => {
      // Aqui a cor e IDENTIDADE do ODS — segue a entidade, nao o ranking.
      const g = montarGrafico({
        fonte: 'desempenho_por_ods',
        linhas: [linhaOds(6, 0.5), linhaOds(7, 0.25)],
      });

      expect(g.itens.find((i) => i.rotulo.startsWith('ODS 6'))?.cor).toBe('#26BDE2');
    });

    it('nao inventa cor para categoria sem paleta propria', () => {
      // Sem identidade de cor, uma cor so para toda a serie (definida no front).
      const g = montarGrafico({
        fonte: 'desempenho_por_regiao',
        linhas: [
          { regionLabel: 'Rio do Sul', taxaAcerto: 0.5, totalRespostas: 20 },
          { regionLabel: 'Taio', taxaAcerto: 0.3, totalRespostas: 20 },
        ],
      });

      expect(g.itens.every((i) => i.cor === undefined)).toBe(true);
    });

    it('mantem a cor colada na entidade mesmo mudando a ordem', () => {
      // Filtrar nao pode repintar quem sobrou.
      const a = montarGrafico({
        fonte: 'desempenho_por_ods',
        linhas: [linhaOds(6, 0.9), linhaOds(7, 0.2)],
      });
      const b = montarGrafico({
        fonte: 'desempenho_por_ods',
        linhas: [linhaOds(6, 0.1), linhaOds(7, 0.8)],
      });

      const corDoSeis = (g: typeof a) => g.itens.find((i) => i.rotulo.startsWith('ODS 6'))?.cor;
      expect(corDoSeis(a)).toBe(corDoSeis(b));
    });
  });
});
