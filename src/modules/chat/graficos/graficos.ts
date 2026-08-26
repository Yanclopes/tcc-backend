import { EspecificacaoDeGrafico, FormatoDeValor, ItemDoGrafico } from '../chat.types';

/**
 * Converte o retorno de uma consulta em um grafico.
 *
 * Funcao pura e testavel — nao conhece banco, nem OpenAI. Ver graficos.spec.ts.
 *
 * A REGRA: o modelo escolhe a forma e a fonte; QUEM VAI NO EIXO e decidido
 * aqui, em codigo. Deixar o modelo nomear o rotulo ou o valor reintroduziria a
 * fabricacao dentro de um grafico, que e pior que dentro de um texto: o grafico
 * carrega autoridade visual e ninguem confere o eixo.
 */

/** Teto de barras. Acima disso vira parede e nao se le mais nada. */
export const MAXIMO_DE_BARRAS = 15;

/** Cores oficiais da ONU. Aqui a cor e IDENTIDADE do ODS, nao intensidade. */
const COR_DO_ODS: Record<number, string> = {
  1: '#E5243B',
  2: '#DDA63A',
  3: '#4C9F38',
  4: '#C5192D',
  5: '#FF3A21',
  6: '#26BDE2',
  7: '#FCC30B',
  8: '#A21942',
  9: '#FD6925',
  10: '#DD1367',
  11: '#FD9D24',
  12: '#BF8B2E',
  13: '#3F7E44',
  14: '#0A97D9',
  15: '#56C02B',
  16: '#00689D',
  17: '#19486A',
};

/** Metrica plotavel: como extrair valor e detalhe de uma linha da consulta. */
interface Metrica {
  formato: FormatoDeValor;
  sufixoDoTitulo: string;
  valor: (linha: Record<string, unknown>) => number;
  detalhe?: (linha: Record<string, unknown>) => string | undefined;
}

/** Como uma fonte de dados vira grafico. */
interface Fonte {
  rotulo: (linha: Record<string, unknown>) => string;
  cor?: (linha: Record<string, unknown>) => string | undefined;
  metricaPadrao: string;
  metricas: Record<string, Metrica>;
}

const numero = (valor: unknown): number => {
  const n = typeof valor === 'string' ? Number.parseFloat(valor) : valor;
  return typeof n === 'number' && Number.isFinite(n) ? n : 0;
};

const texto = (valor: unknown): string => (valor == null ? '—' : String(valor));

const respostasComoDetalhe = (linha: Record<string, unknown>): string => {
  const n = numero(linha.totalRespostas ?? linha.respostas);
  return `${n} ${n === 1 ? 'resposta' : 'respostas'}`;
};

/** Taxa de acerto: o back-end devolve 0..1, exibimos como percentual. */
const taxaDeAcerto: Metrica = {
  formato: 'percentual',
  sufixoDoTitulo: 'taxa de acerto',
  valor: (l) => numero(l.taxaAcerto) * 100,
  detalhe: respostasComoDetalhe,
};

const totalDeRespostas: Metrica = {
  formato: 'contagem',
  sufixoDoTitulo: 'respostas',
  valor: (l) => numero(l.totalRespostas ?? l.respostas),
};

/**
 * Catalogo de fontes plotaveis. Uma fonte que nao esta aqui nao vira grafico —
 * de proposito: e a lista fechada do que pode ir para o eixo.
 */
export const FONTES_PLOTAVEIS: Record<string, Fonte> = {
  desempenho_por_ods: {
    rotulo: (l) => `ODS ${numero(l.goalNumber)} — ${texto(l.goalName)}`,
    cor: (l) => COR_DO_ODS[numero(l.goalNumber)],
    metricaPadrao: 'taxa',
    metricas: { taxa: taxaDeAcerto, respostas: totalDeRespostas },
  },
  acerto_por_ods_consolidado: {
    rotulo: (l) => `ODS ${numero(l.goalNumber ?? l.goal_number)}`,
    cor: (l) => COR_DO_ODS[numero(l.goalNumber ?? l.goal_number)],
    metricaPadrao: 'taxa',
    metricas: { taxa: taxaDeAcerto, respostas: totalDeRespostas },
  },
  desempenho_por_regiao: {
    rotulo: (l) => texto(l.regionLabel),
    metricaPadrao: 'taxa',
    metricas: { taxa: taxaDeAcerto, respostas: totalDeRespostas },
  },
  desempenho_por_pergunta: {
    rotulo: (l) => texto(l.questionText),
    metricaPadrao: 'taxa',
    metricas: {
      taxa: taxaDeAcerto,
      respostas: totalDeRespostas,
      tempo: {
        formato: 'tempo',
        sufixoDoTitulo: 'tempo medio de resposta',
        valor: (l) => numero(l.tempoMedioMs),
        detalhe: respostasComoDetalhe,
      },
    },
  },
  cobertura_do_catalogo: {
    rotulo: (l) => `ODS ${numero(l.goalNumber)} — ${texto(l.goalName)}`,
    cor: (l) => COR_DO_ODS[numero(l.goalNumber)],
    metricaPadrao: 'perguntas',
    metricas: {
      perguntas: {
        formato: 'contagem',
        sufixoDoTitulo: 'perguntas cadastradas',
        valor: (l) => numero(l.perguntasCadastradas),
        detalhe: (l) => `${numero(l.perguntasComResposta)} ja respondida(s)`,
      },
      respostas: totalDeRespostas,
    },
  },
  cobertura_geografica: {
    rotulo: (l) => texto(l.escola ?? l.cidade),
    metricaPadrao: 'respostas',
    metricas: {
      respostas: {
        formato: 'contagem',
        sufixoDoTitulo: 'respostas',
        valor: (l) => numero(l.respostas),
        detalhe: (l) => `${numero(l.alunosCadastrados)} aluno(s) cadastrado(s)`,
      },
      alunos: {
        formato: 'contagem',
        sufixoDoTitulo: 'alunos cadastrados',
        valor: (l) => numero(l.alunosCadastrados),
      },
    },
  },
  desempenho_por_escolaridade: {
    rotulo: (l) =>
      `${texto(l.educationLevelName ?? l.educationLevel)} · ODS ${numero(l.goalNumber)}`,
    metricaPadrao: 'taxa',
    metricas: { taxa: taxaDeAcerto, respostas: totalDeRespostas },
  },
};

export class GraficoIndisponivelError extends Error {}

/** Ordena, corta e normaliza as barras. */
function montarItens(linhas: Record<string, unknown>[], fonte: Fonte, metrica: Metrica) {
  const todos: ItemDoGrafico[] = linhas.map((linha) => ({
    rotulo: fonte.rotulo(linha),
    valor: Math.round(metrica.valor(linha) * 100) / 100,
    proporcao: 0,
    detalhe: metrica.detalhe?.(linha),
    cor: fonte.cor?.(linha),
  }));

  const ordenados = [...todos].sort((a, b) => b.valor - a.valor);
  const itens = ordenados.slice(0, MAXIMO_DE_BARRAS);

  // Proporcao relativa ao maior valor — a barra so compara dentro do grafico.
  const maior = Math.max(...itens.map((i) => i.valor), 0);
  for (const item of itens) {
    item.proporcao = maior > 0 ? item.valor / maior : 0;
  }

  return { itens, truncados: ordenados.length - itens.length };
}

/**
 * Monta o grafico a partir das linhas de uma consulta ja executada.
 *
 * Lanca GraficoIndisponivelError quando a visualizacao nao se sustenta — nesses
 * casos o assistente deve explicar em texto, e nao desenhar algo vazio.
 */
export function montarGrafico(params: {
  fonte: string;
  linhas: unknown;
  metrica?: string;
  titulo?: string;
}): EspecificacaoDeGrafico {
  const fonte = FONTES_PLOTAVEIS[params.fonte];
  if (!fonte) {
    throw new GraficoIndisponivelError(
      `Nao ha grafico para a fonte '${params.fonte}'. Fontes plotaveis: ` +
        `${Object.keys(FONTES_PLOTAVEIS).join(', ')}.`,
    );
  }

  if (!Array.isArray(params.linhas) || params.linhas.length === 0) {
    throw new GraficoIndisponivelError('A consulta nao devolveu nenhuma linha para plotar.');
  }

  const nomeDaMetrica =
    params.metrica && fonte.metricas[params.metrica] ? params.metrica : fonte.metricaPadrao;
  const metrica = fonte.metricas[nomeDaMetrica];

  const linhas = params.linhas as Record<string, unknown>[];
  const { itens, truncados } = montarItens(linhas, fonte, metrica);

  if (itens.every((i) => i.valor === 0)) {
    throw new GraficoIndisponivelError(
      'Todos os valores sao zero — um grafico de barras vazias nao comunica nada. ' +
        'Explique o resultado em texto.',
    );
  }

  const titulo = params.titulo?.trim() || `Comparativo — ${metrica.sufixoDoTitulo}`;

  // Uma linha so nao vira barra: grafico de uma barra e ruido, o numero e o
  // grafico. Ver .specs/06-chat-ia.md secao "Graficos".
  if (itens.length === 1) {
    return {
      tipo: 'indicador',
      titulo,
      formato: metrica.formato,
      itens,
      fonte: params.fonte,
    };
  }

  const notas: string[] = [];
  if (truncados > 0) {
    notas.push(`Mostrando os ${itens.length} maiores de ${itens.length + truncados}.`);
  }
  // Amostra pequena e a ressalva que mais importa aqui: barra comprida sobre 3
  // respostas parece solida e nao e.
  if (metrica.formato === 'percentual') {
    const fracos = linhas.filter((l) => numero(l.totalRespostas ?? l.respostas) < 10).length;
    if (fracos > 0) {
      notas.push(`${fracos} item(ns) com menos de 10 respostas — percentual instavel.`);
    }
  }

  return {
    tipo: 'barras',
    titulo,
    formato: metrica.formato,
    itens,
    fonte: params.fonte,
    nota: notas.length ? notas.join(' ') : undefined,
  };
}
