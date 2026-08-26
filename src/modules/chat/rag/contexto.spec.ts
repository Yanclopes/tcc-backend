import { TrechoRecuperado } from '../chat.types';
import { mensagensDeContexto, montarBlocosDeContexto } from './contexto';

function trecho(fonte: string, texto: string): TrechoRecuperado {
  return { trechoId: 1, documentoId: 1, fonte, titulo: fonte, texto, similaridade: 0.5 };
}

const curado = trecho('curado:playbook-operacional', 'Revise a pergunta quando...');
const doBanco = trecho('banco:question:20', 'Pergunta 20 — ODS 10');

describe('contexto', () => {
  describe('montarBlocosDeContexto', () => {
    it('separa a base curada do que veio do banco', () => {
      const blocos = montarBlocosDeContexto([curado, doBanco]);

      expect(blocos.conhecimento).toContain('Revise a pergunta');
      expect(blocos.conhecimento).not.toContain('Pergunta 20');
      expect(blocos.amostraDoCatalogo).toContain('Pergunta 20');
      expect(blocos.amostraDoCatalogo).not.toContain('Revise a pergunta');
    });

    it('devolve nulo para a faixa que nao trouxe nada', () => {
      expect(montarBlocosDeContexto([curado]).amostraDoCatalogo).toBeNull();
      expect(montarBlocosDeContexto([doBanco]).conhecimento).toBeNull();
    });
  });

  describe('mensagensDeContexto', () => {
    it('avisa que a amostra do catalogo nao e o conjunto completo', () => {
      // Regressao: sem esse aviso o modelo tratava as perguntas recuperadas
      // como a lista relevante e filtrava a consulta por elas, respondendo
      // sobre um subconjunto com aparencia de resposta completa.
      const [, amostra] = mensagensDeContexto([curado, doBanco]);

      expect(amostra).toContain('NAO e uma selecao');
      expect(amostra).toContain('sem filtro');
    });

    it('nao emite o bloco de amostra quando so ha conhecimento curado', () => {
      const mensagens = mensagensDeContexto([curado]);

      expect(mensagens).toHaveLength(1);
      expect(mensagens[0]).toContain('CONHECIMENTO DA PLATAFORMA');
    });

    it('emite os dois blocos rotulados quando ha as duas fontes', () => {
      const mensagens = mensagensDeContexto([curado, doBanco]);

      expect(mensagens).toHaveLength(2);
      expect(mensagens[0]).toContain('CONHECIMENTO DA PLATAFORMA');
      expect(mensagens[1]).toContain('AMOSTRA DO CATALOGO');
    });

    it('instrui a dizer que esta fora de escopo quando nada foi recuperado', () => {
      const mensagens = mensagensDeContexto([]);

      expect(mensagens).toHaveLength(1);
      expect(mensagens[0]).toContain('nao encontrou nada relevante');
    });

    it('preserva o texto integral dos trechos', () => {
      // O modelo precisa do trecho inteiro; truncar aqui degradaria a resposta.
      const mensagens = mensagensDeContexto([curado, doBanco]);

      expect(mensagens.join('\n')).toContain(curado.texto);
      expect(mensagens.join('\n')).toContain(doBanco.texto);
    });
  });
});
