/**
 * Fatiamento do corpus em trechos indexaveis.
 *
 * Funcao pura, sem dependencia de banco nem de rede — o que a torna
 * inteiramente testavel. Ver chunking.spec.ts.
 *
 * Estrategia: o corpus curado e markdown com secoes bem delimitadas por `##`,
 * e cada secao trata de um assunto so. Entao a secao e a unidade natural de
 * recuperacao: fatiar por tamanho fixo cortaria no meio de uma definicao.
 * Secoes grandes demais sao subdivididas por paragrafo, com sobreposicao para
 * nao perder o contexto na emenda.
 */

/** Teto de caracteres por trecho. Acima disso a secao e subdividida. */
export const MAX_CARACTERES = 1500;

/**
 * Sobreposicao entre subtrechos de uma mesma secao. Existe para o caso de a
 * resposta cair exatamente na emenda entre dois pedacos.
 */
export const SOBREPOSICAO = 200;

/** Abaixo disso o trecho e ruido: uma linha solta, um titulo orfao. */
export const MIN_CARACTERES = 40;

export interface TrechoFatiado {
  ordem: number;
  texto: string;
}

/**
 * Quebra o texto nos cabecalhos `##` (nivel 2), mantendo o cabecalho junto do
 * seu conteudo. O `#` de nivel 1 (titulo do documento) fica no primeiro bloco.
 */
function separarPorSecao(texto: string): string[] {
  const linhas = texto.split('\n');
  const secoes: string[] = [];
  let atual: string[] = [];

  for (const linha of linhas) {
    // `## ` inicia secao nova; `### ` nao — subsecao fica junto da sua secao.
    if (/^##\s+\S/.test(linha) && !/^###/.test(linha) && atual.length > 0) {
      secoes.push(atual.join('\n'));
      atual = [];
    }
    atual.push(linha);
  }
  if (atual.length > 0) secoes.push(atual.join('\n'));

  return secoes.map((s) => s.trim()).filter(Boolean);
}

/**
 * Subdivide uma secao grande demais, quebrando entre paragrafos e repetindo
 * os ultimos SOBREPOSICAO caracteres no inicio do pedaco seguinte.
 */
function subdividir(secao: string): string[] {
  if (secao.length <= MAX_CARACTERES) return [secao];

  const paragrafos = secao.split(/\n{2,}/);
  const pedacos: string[] = [];
  let atual = '';

  for (const paragrafo of paragrafos) {
    // Paragrafo que sozinho estoura o teto: entra inteiro no seu proprio
    // pedaco. Cortar no meio de um paragrafo estraga mais do que resolve.
    if (paragrafo.length > MAX_CARACTERES) {
      if (atual) {
        pedacos.push(atual.trim());
        atual = '';
      }
      pedacos.push(paragrafo.trim());
      continue;
    }

    if (atual.length + paragrafo.length + 2 > MAX_CARACTERES) {
      pedacos.push(atual.trim());
      atual = atual.slice(-SOBREPOSICAO) + '\n\n' + paragrafo;
    } else {
      atual = atual ? `${atual}\n\n${paragrafo}` : paragrafo;
    }
  }
  if (atual.trim()) pedacos.push(atual.trim());

  return pedacos;
}

/**
 * Fatia um documento inteiro. O titulo e prefixado em todo trecho: sem isso um
 * trecho recuperado isoladamente perde a referencia de origem, e o modelo
 * responde sem saber de que documento aquilo veio.
 */
export function fatiar(titulo: string, texto: string): TrechoFatiado[] {
  const trechos: TrechoFatiado[] = [];
  let ordem = 0;

  for (const secao of separarPorSecao(texto)) {
    for (const pedaco of subdividir(secao)) {
      if (pedaco.length < MIN_CARACTERES) continue;
      trechos.push({ ordem: ordem++, texto: `[${titulo}]\n\n${pedaco}` });
    }
  }

  return trechos;
}

/**
 * Estimativa grosseira de tokens, so para registrar custo — nao para decidir
 * corte. Portugues fica perto de 1 token a cada 3,5 caracteres nos
 * tokenizadores da OpenAI.
 */
export function estimarTokens(texto: string): number {
  return Math.ceil(texto.length / 3.5);
}
