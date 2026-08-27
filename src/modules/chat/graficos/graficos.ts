import {
  CelulaDoGrafico,
  EspecificacaoDeGrafico,
  FormatoDeValor,
  ItemDoGrafico,
} from '../chat.types';

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
 * Cruzamentos plotaveis como matriz (heatmap).
 *
 * Uma matriz e a forma certa quando o dado tem DUAS dimensoes: escolaridade x
 * ODS em barras viraria uma parede de 68 barras, ilegivel. Nao ha outra forma
 * que mostre "onde, no cruzamento, esta o ponto fraco".
 */
const MATRIZES: Record<
  string,
  { linha: (l: Record<string, unknown>) => string; coluna: (l: Record<string, unknown>) => string }
> = {
  desempenho_por_escolaridade: {
    linha: (l) => texto(l.educationLevelName),
    // goalNumber, nunca goalId: o id e autoincrement e muda em um reseed.
    coluna: (l) => `ODS ${numero(l.goalNumber)}`,
  },
};

/** Pares de medidas comparaveis lado a lado — MESMA unidade, mesmo eixo. */
const AGRUPAMENTOS: Record<
  string,
  {
    rotulo: (l: Record<string, unknown>) => string;
    formato: FormatoDeValor;
    series: Array<{ nome: string; cor: string; valor: (l: Record<string, unknown>) => number }>;
  }
> = {
  cobertura_do_catalogo: {
    rotulo: (l) => `ODS ${numero(l.goalNumber)}`,
    formato: 'contagem',
    // Duas contagens de PERGUNTAS: mesma unidade e escalas comparaveis (uma e
    // subconjunto da outra). Este e o criterio para entrar aqui — medidas de
    // unidades diferentes lado a lado no mesmo eixo enganam.
    series: [
      { nome: 'Cadastradas', cor: '#0a97d9', valor: (l) => numero(l.perguntasCadastradas) },
      { nome: 'Ja respondidas', cor: '#f59e0b', valor: (l) => numero(l.perguntasComResposta) },
    ],
  },
};

/*
 * Por que cobertura_geografica NAO esta aqui: as medidas disponiveis sao alunos
 * cadastrados e respostas — unidades diferentes, em escalas que diferem por
 * ordens de grandeza (2 alunos ao lado de 67 respostas). Lado a lado no mesmo
 * eixo, a barra menor vira um traco invisivel e a comparacao engana. Duas
 * escalas num grafico so inventam uma relacao que nao esta no dado. Para essa
 * pergunta, dois graficos separados ou a tabela comunicam melhor.
 */

export const FONTES_DE_MATRIZ = Object.keys(MATRIZES);
export const FONTES_AGRUPAVEIS = Object.keys(AGRUPAMENTOS);

/** Monta um heatmap a partir de linhas que trazem duas dimensoes. */
function montarMatriz(
  fonteNome: string,
  linhas: Record<string, unknown>[],
  titulo: string,
): EspecificacaoDeGrafico {
  const eixos = MATRIZES[fonteNome];
  const celulas: CelulaDoGrafico[] = linhas.map((l) => ({
    linha: eixos.linha(l),
    coluna: eixos.coluna(l),
    valor: Math.round(numero(l.taxaAcerto) * 10000) / 100,
    intensidade: 0,
    detalhe: respostasComoDetalhe(l),
  }));

  // Intensidade normalizada pelo maior valor: a rampa so compara dentro do
  // proprio heatmap.
  const maior = Math.max(...celulas.map((c) => c.valor ?? 0), 0);
  for (const celula of celulas) {
    celula.intensidade = maior > 0 ? (celula.valor ?? 0) / maior : 0;
  }

  const linhasDoEixo = [...new Set(celulas.map((c) => c.linha))].sort();
  // Colunas em ordem numerica do ODS, nao alfabetica ("ODS 10" antes de "ODS 2").
  const colunas = [...new Set(celulas.map((c) => c.coluna))].sort(
    (a, b) =>
      (Number.parseInt(a.replace(/\D/g, ''), 10) || 0) -
      (Number.parseInt(b.replace(/\D/g, ''), 10) || 0),
  );

  const vazias = linhasDoEixo.length * colunas.length - celulas.length;
  const fracas = linhas.filter((l) => numero(l.totalRespostas) < 10).length;
  const notas: string[] = [];
  if (vazias > 0) notas.push(`${vazias} cruzamento(s) sem nenhuma resposta.`);
  if (fracas > 0)
    notas.push(`${fracas} celula(s) com menos de 10 respostas — percentual instavel.`);

  return {
    tipo: 'matriz',
    titulo,
    formato: 'percentual',
    itens: [],
    celulas,
    linhas: linhasDoEixo,
    colunas,
    fonte: fonteNome,
    nota: notas.length ? notas.join(' ') : undefined,
  };
}

/** Monta barras agrupadas: duas medidas da mesma unidade por categoria. */
function montarAgrupado(
  fonteNome: string,
  linhas: Record<string, unknown>[],
  titulo: string,
): EspecificacaoDeGrafico {
  const config = AGRUPAMENTOS[fonteNome];

  // Ordena pela primeira serie e corta: 15 categorias x 2 barras ja e denso.
  const ordenadas = [...linhas]
    .sort((a, b) => config.series[0].valor(b) - config.series[0].valor(a))
    .slice(0, MAXIMO_DE_BARRAS);

  const maior = Math.max(
    ...ordenadas.flatMap((l) => config.series.map((serie) => serie.valor(l))),
    0,
  );

  const itens: ItemDoGrafico[] = ordenadas.map((l) => ({
    rotulo: config.rotulo(l),
    valor: config.series[0].valor(l),
    proporcao: maior > 0 ? config.series[0].valor(l) / maior : 0,
  }));

  const series = config.series.map((serie) => ({
    nome: serie.nome,
    cor: serie.cor,
    valores: ordenadas.map((l) => serie.valor(l)),
  }));

  if (series.every((serie) => serie.valores.every((v) => v === 0))) {
    throw new GraficoIndisponivelError(
      'Todas as series estao zeradas — o grafico nao comunicaria nada. Explique em texto.',
    );
  }

  const truncados = linhas.length - ordenadas.length;

  return {
    tipo: 'barras_agrupadas',
    titulo,
    formato: config.formato,
    itens,
    series,
    fonte: fonteNome,
    nota:
      truncados > 0 ? `Mostrando os ${ordenadas.length} maiores de ${linhas.length}.` : undefined,
  };
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
  /** Forma pedida. Padrao 'barras'; 'indicador' e decidido automaticamente. */
  forma?: 'barras' | 'matriz' | 'barras_agrupadas';
}): EspecificacaoDeGrafico {
  const forma = params.forma ?? 'barras';

  if (forma === 'matriz' || forma === 'barras_agrupadas') {
    if (!Array.isArray(params.linhas) || params.linhas.length === 0) {
      throw new GraficoIndisponivelError('A consulta nao devolveu nenhuma linha para plotar.');
    }
    const linhas = params.linhas as Record<string, unknown>[];
    const titulo = params.titulo?.trim() || 'Comparativo';

    if (forma === 'matriz') {
      if (!MATRIZES[params.fonte]) {
        throw new GraficoIndisponivelError(
          `A fonte '${params.fonte}' nao tem duas dimensoes para cruzar. Fontes com matriz: ` +
            `${FONTES_DE_MATRIZ.join(', ')}.`,
        );
      }
      return montarMatriz(params.fonte, linhas, titulo);
    }

    if (!AGRUPAMENTOS[params.fonte]) {
      throw new GraficoIndisponivelError(
        `A fonte '${params.fonte}' nao tem duas medidas comparaveis. Fontes agrupaveis: ` +
          `${FONTES_AGRUPAVEIS.join(', ')}.`,
      );
    }
    return montarAgrupado(params.fonte, linhas, titulo);
  }

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
  // grafico. Ver tcc-docs/specs/06-chat-ia.md secao "Graficos".
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
