import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from 'openai/resources/chat/completions';
import { Repository } from 'typeorm';
import { AppUser } from '../users/entities/app-user.entity';
import { PassoDoAssistente, RespostaDoAssistente, TrechoRecuperado } from './chat.types';
import { ChatConversa } from './entities/chat-conversa.entity';
import { ChatMensagem, PAPEL_ASSISTENTE, PAPEL_USUARIO } from './entities/chat-mensagem.entity';
import { FerramentasService } from './ferramentas/ferramentas.service';
import { OpenAiService } from './rag/openai.service';
import { RetrieverService } from './rag/retriever.service';

/** Quantas mensagens anteriores acompanham a pergunta. */
const JANELA_DE_HISTORICO = 10;

const INSTRUCAO_DO_SISTEMA = `
Voce e o assistente de analise do Desafio ODS, uma plataforma gamificada que
levanta o conhecimento sobre os Objetivos de Desenvolvimento Sustentavel entre
estudantes do Alto Vale do Itajai (SC). Quem conversa com voce e o pesquisador
responsavel, nao um jogador.

Como trabalhar:

1. O CONTEXTO abaixo vem da base de conhecimento do projeto. Trate-o como a
   verdade sobre metodologia, metricas e regras. Se a resposta estiver nele,
   use-o e diga de qual documento veio.
2. Para qualquer NUMERO — taxa, contagem, media, comparacao entre recortes —
   chame uma ferramenta. Nunca estime, nunca reaproveite numero que apareceu no
   contexto: o contexto e texto indexado e pode estar desatualizado.
3. Se a pergunta estiver fora do escopo do projeto, diga que esta fora do
   escopo. Nao improvise com conhecimento geral.
4. Se o contexto nao cobrir a pergunta e nenhuma ferramenta servir, diga que
   nao sabe. Isso e uma resposta aceitavel e preferivel a inventar.

Como responder:

- Em portugues do Brasil, com markdown quando ajudar.
- Ao apresentar numero, informe sempre o N (quantas respostas sustentam aquilo).
  Percentual sobre poucas dezenas de respostas nao sustenta conclusao, e voce
  deve dizer isso.
- Traga a ressalva metodologica pertinente junto do dado, nao como rodape
  opcional. A amostra e por conveniencia e autosselecionada: nunca generalize
  para a populacao, so descreva quem participou.
- Seja direto. O leitor conhece o projeto.
`.trim();

/**
 * Orquestra uma pergunta: recupera contexto, monta o prompt, roda o laco de
 * ferramentas e persiste. Ver .specs/06-chat-ia.md.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    @InjectRepository(ChatConversa)
    private readonly conversaRepo: Repository<ChatConversa>,
    @InjectRepository(ChatMensagem)
    private readonly mensagemRepo: Repository<ChatMensagem>,
    private readonly openai: OpenAiService,
    private readonly retriever: RetrieverService,
    private readonly ferramentas: FerramentasService,
  ) {}

  get habilitado(): boolean {
    return this.openai.habilitado;
  }

  // ------------------------------------------------------------------
  // Conversas
  // ------------------------------------------------------------------
  async criarConversa(usuarioId: number, titulo?: string): Promise<ChatConversa> {
    return this.conversaRepo.save(
      this.conversaRepo.create({
        usuario: { id: usuarioId } as AppUser,
        titulo: (titulo ?? 'Nova conversa').slice(0, 200),
      }),
    );
  }

  async listarConversas(usuarioId: number): Promise<ChatConversa[]> {
    return this.conversaRepo.find({
      where: { usuario: { id: usuarioId } },
      order: { atualizadaEm: 'DESC' },
      take: 50,
    });
  }

  /** Busca a conversa garantindo que ela pertence a quem pediu. */
  private async conversaDoUsuario(id: string, usuarioId: number): Promise<ChatConversa> {
    const conversa = await this.conversaRepo.findOne({
      where: { id, usuario: { id: usuarioId } },
    });
    if (!conversa) throw new NotFoundException('Conversa nao encontrada.');
    return conversa;
  }

  async obterConversa(
    id: string,
    usuarioId: number,
  ): Promise<{ conversa: ChatConversa; mensagens: ChatMensagem[] }> {
    const conversa = await this.conversaDoUsuario(id, usuarioId);
    const mensagens = await this.mensagemRepo.find({
      where: { conversa: { id } },
      order: { id: 'ASC' },
    });
    return { conversa, mensagens };
  }

  async removerConversa(id: string, usuarioId: number): Promise<void> {
    const conversa = await this.conversaDoUsuario(id, usuarioId);
    await this.conversaRepo.remove(conversa);
  }

  // ------------------------------------------------------------------
  // Pergunta
  // ------------------------------------------------------------------
  async perguntar(
    conversaId: string,
    usuarioId: number,
    pergunta: string,
  ): Promise<{ mensagem: ChatMensagem; trechosCitados: TrechoRecuperado[] }> {
    const texto = pergunta.trim();
    if (!texto) throw new BadRequestException('A pergunta nao pode estar vazia.');

    const conversa = await this.conversaDoUsuario(conversaId, usuarioId);
    const historico = await this.mensagemRepo.find({
      where: { conversa: { id: conversaId } },
      order: { id: 'DESC' },
      take: JANELA_DE_HISTORICO,
    });

    await this.mensagemRepo.save(
      this.mensagemRepo.create({
        conversa: { id: conversaId } as ChatConversa,
        papel: PAPEL_USUARIO,
        conteudo: texto,
      }),
    );

    const resposta = await this.responder(texto, historico.reverse());

    const mensagem = await this.mensagemRepo.save(
      this.mensagemRepo.create({
        conversa: { id: conversaId } as ChatConversa,
        papel: PAPEL_ASSISTENTE,
        conteudo: resposta.conteudo,
        passos: resposta.passos,
        tokensPrompt: resposta.tokensPrompt,
        tokensSaida: resposta.tokensSaida,
      }),
    );

    // Conversa nova herda o titulo da primeira pergunta.
    if (historico.length === 0) {
      conversa.titulo = texto.slice(0, 200);
    }
    conversa.atualizadaEm = new Date();
    await this.conversaRepo.save(conversa);

    return { mensagem, trechosCitados: resposta.trechosCitados };
  }

  /**
   * O laco: recupera, pergunta ao modelo, executa ferramenta se ele pedir,
   * repete. O teto de passos existe para um loop nao queimar cota.
   */
  private async responder(
    pergunta: string,
    historico: ChatMensagem[],
  ): Promise<RespostaDoAssistente> {
    const passos: PassoDoAssistente[] = [];

    const trechos = await this.retriever.recuperar(pergunta);
    passos.push({
      tipo: 'recuperacao',
      trechos: trechos.map((t) => ({
        fonte: t.fonte,
        titulo: t.titulo,
        similaridade: Number(t.similaridade.toFixed(3)),
      })),
    });

    const contexto = trechos.length
      ? trechos.map((t) => t.texto).join('\n\n---\n\n')
      : '(a busca na base de conhecimento nao encontrou nada relevante para esta pergunta)';

    const mensagens: ChatCompletionMessageParam[] = [
      { role: 'system', content: INSTRUCAO_DO_SISTEMA },
      { role: 'system', content: `CONTEXTO recuperado da base de conhecimento:\n\n${contexto}` },
      ...historico.map((m): ChatCompletionMessageParam => ({
        role: m.papel === PAPEL_USUARIO ? 'user' : 'assistant',
        content: m.conteudo,
      })),
      { role: 'user', content: pergunta },
    ];

    let tokensPrompt = 0;
    let tokensSaida = 0;

    for (let passo = 0; passo < this.openai.maxPassos; passo += 1) {
      const conclusao = await this.openai.chat.completions.create({
        model: this.openai.modeloChat,
        messages: mensagens,
        tools: this.ferramentas.declaracoes,
      });

      tokensPrompt += conclusao.usage?.prompt_tokens ?? 0;
      tokensSaida += conclusao.usage?.completion_tokens ?? 0;

      const escolha = conclusao.choices[0]?.message;
      if (!escolha) break;

      const chamadas = escolha.tool_calls ?? [];
      if (chamadas.length === 0) {
        return {
          conteudo: escolha.content?.trim() || '(o modelo nao retornou texto)',
          passos,
          trechosCitados: trechos,
          tokensPrompt,
          tokensSaida,
        };
      }

      mensagens.push(escolha);
      for (const chamada of chamadas) {
        mensagens.push(await this.executarChamada(chamada, passos));
      }
    }

    // Estourou o teto de passos sem o modelo concluir.
    this.logger.warn(`Laco de ferramentas atingiu o teto de ${this.openai.maxPassos} passos.`);
    return {
      conteudo:
        'Nao consegui concluir a analise dentro do limite de consultas por pergunta. ' +
        'Tente uma pergunta mais especifica — por exemplo, delimitando um ODS ou uma cidade.',
      passos,
      trechosCitados: trechos,
      tokensPrompt,
      tokensSaida,
    };
  }

  /** Executa uma chamada de ferramenta e devolve a mensagem de retorno. */
  private async executarChamada(
    chamada: ChatCompletionMessageToolCall,
    passos: PassoDoAssistente[],
  ): Promise<ChatCompletionMessageParam> {
    // A tipagem do SDK cobre outros tipos de tool alem de function; so tratamos
    // function, que e o unico que declaramos.
    if (chamada.type !== 'function') {
      return {
        role: 'tool',
        tool_call_id: chamada.id,
        content: 'Tipo de ferramenta nao suportado.',
      };
    }

    const nome = chamada.function.name;
    let argumentos: Record<string, unknown> = {};
    try {
      argumentos = chamada.function.arguments
        ? (JSON.parse(chamada.function.arguments) as Record<string, unknown>)
        : {};
    } catch {
      // Modelo mandou JSON invalido: devolve o erro para ele se corrigir na
      // proxima volta, em vez de derrubar a requisicao inteira.
      passos.push({
        tipo: 'ferramenta',
        nome,
        argumentos: {},
        resumo: '',
        erro: 'argumentos em JSON invalido',
      });
      return {
        role: 'tool',
        tool_call_id: chamada.id,
        content: 'Erro: os argumentos enviados nao sao JSON valido. Reenvie a chamada.',
      };
    }

    try {
      const retorno = await this.ferramentas.executar(nome, argumentos);
      const serializado = JSON.stringify(retorno);
      passos.push({
        tipo: 'ferramenta',
        nome,
        argumentos,
        resumo: Array.isArray(retorno)
          ? `${retorno.length} linha(s)`
          : `${serializado.length} caracteres`,
      });
      return { role: 'tool', tool_call_id: chamada.id, content: serializado };
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      this.logger.error(`Ferramenta '${nome}' falhou: ${mensagem}`);
      passos.push({ tipo: 'ferramenta', nome, argumentos, resumo: '', erro: mensagem });
      return {
        role: 'tool',
        tool_call_id: chamada.id,
        content: `Erro ao executar a ferramenta: ${mensagem}`,
      };
    }
  }
}
