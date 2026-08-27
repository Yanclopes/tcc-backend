import { TrechoRecuperado } from '../chat.types';

/**
 * Monta os blocos de contexto enviados ao modelo.
 *
 * Existe separado (e testavel) por causa de um problema medido: quando os
 * trechos das duas fontes vinham num bloco unico rotulado "contexto", o modelo
 * tratava as perguntas recuperadas como se fossem *a lista relevante*. Numa
 * pergunta de varredura ("quais perguntas eu deveria revisar?"), ele chamava a
 * ferramenta filtrando pelos ODS que por acaso apareceram no contexto, em vez
 * de consultar o catalogo inteiro — devolvendo resposta parcial com aparencia
 * de completa.
 *
 * A correcao e dar papeis explicitos aos dois blocos: o curado e conhecimento
 * a ser aplicado; o derivado do banco e amostra ilustrativa, jamais recorte.
 */

/** Trecho vindo da base curada (escrita a mao para o assistente). */
const PREFIXO_CURADO = 'curado:';

const SEPARADOR = '\n\n---\n\n';

export interface BlocosDeContexto {
  /** Conhecimento operacional: metricas, regras, playbook, cautelas. */
  conhecimento: string | null;
  /** Itens do catalogo que casaram com a busca. NAO e uma selecao. */
  amostraDoCatalogo: string | null;
}

export function montarBlocosDeContexto(trechos: TrechoRecuperado[]): BlocosDeContexto {
  const curados = trechos.filter((t) => t.fonte.startsWith(PREFIXO_CURADO));
  const doBanco = trechos.filter((t) => !t.fonte.startsWith(PREFIXO_CURADO));

  return {
    conhecimento: curados.length ? curados.map((t) => t.texto).join(SEPARADOR) : null,
    amostraDoCatalogo: doBanco.length ? doBanco.map((t) => t.texto).join(SEPARADOR) : null,
  };
}

/** Converte os blocos nas mensagens de sistema que acompanham a pergunta. */
export function mensagensDeContexto(trechos: TrechoRecuperado[]): string[] {
  const { conhecimento, amostraDoCatalogo } = montarBlocosDeContexto(trechos);
  const mensagens: string[] = [];

  if (conhecimento) {
    mensagens.push('CONHECIMENTO DA PLATAFORMA — aplique isto ao responder:\n\n' + conhecimento);
  }

  if (amostraDoCatalogo) {
    // O aviso e a peca central da correcao. Sem ele o modelo confunde "o que a
    // busca trouxe" com "o que existe".
    mensagens.push(
      'AMOSTRA DO CATALOGO — apenas os itens que casaram com a busca textual.\n' +
        'ATENCAO: isto NAO e uma selecao, NAO e um ranking e NAO e o conjunto ' +
        'completo. Existem outros itens que nao aparecem aqui. Nunca restrinja ' +
        'uma consulta aos ODS, escolas ou perguntas citados neste bloco — para ' +
        'saber o que existe, use as ferramentas sem filtro.\n\n' +
        amostraDoCatalogo,
    );
  }

  if (mensagens.length === 0) {
    mensagens.push(
      'A busca na base de conhecimento nao encontrou nada relevante para esta ' +
        'pergunta. Se ela estiver fora do escopo da plataforma, diga isso.',
    );
  }

  return mensagens;
}
