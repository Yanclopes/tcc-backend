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
  tokensPrompt: number;
  tokensSaida: number;
}
