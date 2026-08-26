import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ChatConfig } from '../../../config/configuration';

/**
 * Ponto unico de contato com a OpenAI.
 *
 * Concentrar aqui resolve tres coisas de uma vez: a chave nunca se espalha pelo
 * codigo, a ausencia dela e tratada num lugar so, e os erros da API viram
 * mensagem legivel antes de subir.
 */
@Injectable()
export class OpenAiService {
  private readonly logger = new Logger(OpenAiService.name);
  private readonly cfg: ChatConfig;
  private readonly cliente: OpenAI | null;

  constructor(private readonly config: ConfigService) {
    this.cfg = this.config.getOrThrow<ChatConfig>('chat');
    // Sem chave o modulo sobe DESABILITADO em vez de derrubar a aplicacao: o
    // chat e acessorio, o resto da plataforma nao depende dele.
    this.cliente = this.cfg.apiKey ? new OpenAI({ apiKey: this.cfg.apiKey }) : null;
    if (!this.cliente) {
      this.logger.warn(
        'OPENAI_API_KEY ausente — o modulo de chat sobe desabilitado e as rotas /chat respondem 503.',
      );
    }
  }

  /** Se false, as rotas do chat devem responder 503 com mensagem clara. */
  get habilitado(): boolean {
    return this.cliente !== null;
  }

  get modeloChat(): string {
    return this.cfg.modeloChat;
  }

  get modeloEmbedding(): string {
    return this.cfg.modeloEmbedding;
  }

  get dimensaoEmbedding(): number {
    return this.cfg.dimensaoEmbedding;
  }

  get topK(): number {
    return this.cfg.topK;
  }

  get maxPassos(): number {
    return this.cfg.maxPassos;
  }

  private exigirCliente(): OpenAI {
    if (!this.cliente) {
      throw new ServiceUnavailableException(
        'O assistente de IA nao esta configurado nesta instalacao. ' +
          'Defina OPENAI_API_KEY no ambiente do backend para habilita-lo.',
      );
    }
    return this.cliente;
  }

  /**
   * Gera embeddings para um lote de textos. A ordem do retorno acompanha a
   * ordem da entrada — a API garante isso pelo campo `index`, que reordenamos
   * explicitamente para nao depender do acaso.
   */
  async gerarEmbeddings(textos: string[]): Promise<number[][]> {
    if (textos.length === 0) return [];
    const cliente = this.exigirCliente();

    try {
      const resposta = await cliente.embeddings.create({
        model: this.cfg.modeloEmbedding,
        input: textos,
        dimensions: this.cfg.dimensaoEmbedding,
      });
      return [...resposta.data]
        .sort((a, b) => a.index - b.index)
        .map((item) => item.embedding as number[]);
    } catch (erro) {
      throw this.traduzirErro(erro);
    }
  }

  /** Embedding de um texto so — atalho para a consulta do usuario. */
  async gerarEmbedding(texto: string): Promise<number[]> {
    const [embedding] = await this.gerarEmbeddings([texto]);
    return embedding;
  }

  /** Acesso direto ao cliente para o laco de conversa, que usa tool calling. */
  get chat(): OpenAI['chat'] {
    return this.exigirCliente().chat;
  }

  /**
   * Traduz os erros mais comuns da API em algo que o usuario entenda. Deixar o
   * erro cru subir expoe detalhe de infraestrutura e nao ajuda ninguem.
   */
  traduzirErro(erro: unknown): Error {
    const texto = erro instanceof Error ? erro.message : String(erro);

    if (texto.includes('401') || texto.includes('invalid_api_key')) {
      return new ServiceUnavailableException(
        'A chave da OpenAI foi rejeitada. Verifique OPENAI_API_KEY no ambiente do backend.',
      );
    }
    if (texto.includes('429') || texto.includes('rate_limit')) {
      return new ServiceUnavailableException(
        'Limite de uso da OpenAI atingido. Tente novamente em alguns instantes.',
      );
    }
    if (texto.includes('insufficient_quota')) {
      return new ServiceUnavailableException(
        'A conta da OpenAI esta sem credito. Verifique o faturamento em platform.openai.com.',
      );
    }
    if (texto.includes('404') || texto.includes('model_not_found')) {
      return new ServiceUnavailableException(
        `O modelo configurado nao esta disponivel para esta chave. ` +
          `Ajuste OPENAI_MODEL_CHAT / OPENAI_MODEL_EMBEDDING.`,
      );
    }

    this.logger.error(`Erro nao mapeado da OpenAI: ${texto}`);
    return new ServiceUnavailableException('Falha ao consultar o assistente de IA.');
  }
}
