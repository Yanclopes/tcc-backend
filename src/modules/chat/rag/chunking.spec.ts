import { BASE_CURADA } from '../conhecimento';
import { MAX_CARACTERES, MIN_CARACTERES, estimarTokens, fatiar } from './chunking';

describe('chunking', () => {
  describe('fatiar', () => {
    it('quebra o texto nos cabecalhos de nivel 2', () => {
      // Cada secao precisa passar de MIN_CARACTERES, senao e descartada como
      // ruido — comportamento coberto pelo teste de trecho curto.
      const texto = [
        '# Titulo',
        '',
        'Paragrafo de abertura com tamanho suficiente para ser indexado.',
        '',
        '## Primeira',
        '',
        'Conteudo da primeira secao, com tamanho suficiente.',
        '',
        '## Segunda',
        '',
        'Conteudo da segunda secao, tambem com tamanho suficiente.',
      ].join('\n');

      const trechos = fatiar('Doc', texto);

      expect(trechos).toHaveLength(3);
      expect(trechos[0].texto).toContain('Paragrafo de abertura');
      expect(trechos[1].texto).toContain('Primeira');
      expect(trechos[2].texto).toContain('Segunda');
    });

    it('mantem subsecoes (###) junto da secao a que pertencem', () => {
      const texto = [
        '## Secao',
        '',
        'Corpo da secao com tamanho suficiente.',
        '',
        '### Subsecao',
        '',
        'Detalhe.',
      ].join('\n');

      const trechos = fatiar('Doc', texto);

      expect(trechos).toHaveLength(1);
      expect(trechos[0].texto).toContain('Subsecao');
    });

    it('prefixa o titulo do documento em todo trecho', () => {
      // Sem isso um trecho recuperado isoladamente perde a referencia de origem.
      const trechos = fatiar('Metricas', '## Uma\n\nTexto com tamanho suficiente para passar.');

      expect(trechos[0].texto.startsWith('[Metricas]')).toBe(true);
    });

    it('numera a ordem sequencialmente a partir de zero', () => {
      const texto = [
        '## A',
        '',
        'Primeiro bloco, com tamanho suficiente para nao ser descartado.',
        '',
        '## B',
        '',
        'Segundo bloco, com tamanho suficiente para nao ser descartado.',
      ].join('\n');

      expect(fatiar('Doc', texto).map((t) => t.ordem)).toEqual([0, 1]);
    });

    it('descarta trechos curtos demais para serem uteis', () => {
      const texto = [
        '## Titulo orfao',
        '',
        '## Secao real',
        '',
        'x'.repeat(MIN_CARACTERES + 10),
      ].join('\n');

      const trechos = fatiar('Doc', texto);

      expect(trechos).toHaveLength(1);
      expect(trechos[0].texto).toContain('Secao real');
    });

    it('subdivide secao que estoura o teto de caracteres', () => {
      const paragrafo = 'palavra '.repeat(60).trim(); // ~480 caracteres
      const texto = ['## Grande', '', paragrafo, '', paragrafo, '', paragrafo, '', paragrafo].join(
        '\n',
      );

      const trechos = fatiar('Doc', texto);

      expect(trechos.length).toBeGreaterThan(1);
    });

    it('nao parte um paragrafo unico que sozinho estoura o teto', () => {
      // Cortar no meio de um paragrafo estraga mais do que resolve.
      const gigante = 'a'.repeat(MAX_CARACTERES + 500);

      const trechos = fatiar('Doc', `## Secao\n\n${gigante}`);

      expect(trechos.some((t) => t.texto.includes(gigante))).toBe(true);
    });

    it('devolve vazio para texto sem conteudo aproveitavel', () => {
      expect(fatiar('Doc', '   \n\n  ')).toEqual([]);
    });
  });

  describe('estimarTokens', () => {
    it('cresce com o tamanho do texto', () => {
      expect(estimarTokens('a'.repeat(350))).toBeGreaterThan(estimarTokens('a'.repeat(35)));
    });

    it('nunca devolve zero para texto nao vazio', () => {
      expect(estimarTokens('oi')).toBeGreaterThan(0);
    });
  });

  describe('base curada', () => {
    it('tem fontes unicas', () => {
      // Fonte duplicada faria um documento sobrescrever o outro na indexacao,
      // porque e a chave unica de chat_documento.
      const fontes = BASE_CURADA.map((d) => d.fonte);
      expect(new Set(fontes).size).toBe(fontes.length);
    });

    it('usa o prefixo "curado:" em todas as fontes', () => {
      // O prefixo separa a Fonte A da Fonte B (derivada do banco).
      expect(BASE_CURADA.every((d) => d.fonte.startsWith('curado:'))).toBe(true);
    });

    it('produz pelo menos um trecho por documento', () => {
      for (const documento of BASE_CURADA) {
        expect(fatiar(documento.titulo, documento.texto).length).toBeGreaterThan(0);
      }
    });
  });
});
