/**
 * Tipos compartilhados do modulo de chat. Ver .specs/06-chat-ia.md.
 */

/** Um documento da base curada, escrito em conhecimento/*.ts. */
export interface DocumentoDeConhecimento {
  /** Identificador estavel. Prefixo 'curado:' para a base escrita a mao. */
  fonte: string;
  titulo: string;
  texto: string;
}

/** Trecho recuperado pela busca vetorial, com a distancia que o classificou. */
export interface TrechoRecuperado {
  trechoId: number;
  documentoId: number;
  fonte: string;
  titulo: string;
  texto: string;
  /** Similaridade de cosseno em [0, 1]. Quanto maior, mais proximo. */
  similaridade: number;
}

/**
 * Um passo do raciocinio, devolvido junto da resposta.
 *
 * Existe por dois motivos: da transparencia ao usuario (o RAG deixa de ser
 * caixa-preta) e permite analisar, no artigo, quais ferramentas o assistente
 * de fato aciona.
 */
export type PassoDoAssistente =
  | {
      tipo: 'recuperacao';
      /** Quantos trechos vieram e de quais documentos. */
      trechos: Array<{ fonte: string; titulo: string; similaridade: number }>;
    }
  | {
      tipo: 'ferramenta';
      nome: string;
      argumentos: Record<string, unknown>;
      /** Resumo do retorno — nao o payload inteiro, que pode ser grande. */
      resumo: string;
      erro?: string;
    };

/** Resultado de uma pergunta processada pelo assistente. */
export interface RespostaDoAssistente {
  conteudo: string;
  passos: PassoDoAssistente[];
  trechosCitados: TrechoRecuperado[];
  graficos: EspecificacaoDeGrafico[];
  tokensPrompt: number;
  tokensSaida: number;
}

// ---------------------------------------------------------------------------
// Graficos
// ---------------------------------------------------------------------------

/** Como o valor deve ser lido e formatado. */
export type FormatoDeValor = 'percentual' | 'contagem' | 'tempo';

/** Uma barra (ou o valor unico de um indicador). */
export interface ItemDoGrafico {
  rotulo: string;
  /** Valor bruto, ja no formato indicado por `formato`. */
  valor: number;
  /** 0..1 — comprimento relativo da barra. Calculado no back-end. */
  proporcao: number;
  /** Linha secundaria: quase sempre o N que sustenta o valor. */
  detalhe?: string;
  /** Cor da barra. So preenchida quando a cor carrega identidade (ODS). */
  cor?: string;
}

/**
 * Um grafico pronto para renderizar.
 *
 * Montado inteiramente no back-end a partir do retorno de uma consulta real. O
 * modelo escolhe a forma e a fonte; nunca os numeros nem o que vai no eixo.
 */
export interface EspecificacaoDeGrafico {
  /** 'indicador' quando ha um valor so — grafico de uma barra e ruido. */
  tipo: 'barras' | 'indicador';
  titulo: string;
  formato: FormatoDeValor;
  itens: ItemDoGrafico[];
  /** Qual ferramenta produziu os dados. Aparece como procedencia na interface. */
  fonte: string;
  /** Ressalva exibida junto ao grafico (ex.: lista truncada, amostra pequena). */
  nota?: string;
}
