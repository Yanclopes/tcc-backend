import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from 'openai/resources/chat/completions';
import { Repository } from 'typeorm';
import { AppUser } from '../users/entities/app-user.entity';
import {
  AcaoProposta,
  EspecificacaoDeGrafico,
  PassoDoAssistente,
  RespostaDoAssistente,
  TrechoRecuperado,
} from './chat.types';
import { ChatConversa } from './entities/chat-conversa.entity';
import { ChatMensagem, PAPEL_ASSISTENTE, PAPEL_USUARIO } from './entities/chat-mensagem.entity';
import { mensagensDeContexto } from './rag/contexto';
import { FerramentasService } from './ferramentas/ferramentas.service';
import { OpenAiService } from './rag/openai.service';
import { RetrieverService } from './rag/retriever.service';

/** Quantas mensagens anteriores acompanham a pergunta. */
const JANELA_DE_HISTORICO = 10;

const INSTRUCAO_DO_SISTEMA = `
Voce e o assistente do painel administrativo do Desafio ODS, uma plataforma
gamificada que levanta o conhecimento sobre os Objetivos de Desenvolvimento
Sustentavel entre estudantes do Alto Vale do Itajai (SC).

Quem conversa com voce ADMINISTRA a plataforma. Ele quer decidir uma acao:
revisar uma pergunta, desativar outra, aprovar uma escola sugerida, saber onde
a divulgacao ainda nao chegou. Ele nao esta escrevendo um trabalho academico —
nao ofereca julgamento sobre o que "pode ser citado" nem redija conclusoes de
pesquisa.

Como trabalhar:

1. O CONTEXTO abaixo vem da base de conhecimento da plataforma. Trate-o como a
   verdade sobre metricas, regras do jogo e o que fazer com cada sinal.
2. Para qualquer NUMERO — taxa, contagem, media, comparacao entre recortes —
   chame uma ferramenta. Nunca estime e nunca reaproveite numero que apareceu no
   contexto: o contexto e texto indexado e pode estar desatualizado.
3. NUNCA afirme um dado que a ferramenta nao devolveu. Se voce nao tem a
   contagem de perguntas por ODS, diga que nao tem — nao chute um valor
   plausivel. Numero inventado ao lado de numero correto e o pior erro
   possivel, porque nao ha como distinguir os dois.
4. VARREDURA ANTES DE FILTRAR. Se a pergunta for do tipo "quais", "onde",
   "algum", "liste" ou "o que eu deveria", ela pede o conjunto INTEIRO: chame a
   ferramenta SEM filtro e trie o resultado voce mesmo. So use filtro quando o
   proprio usuario delimitou o recorte (um ODS, uma cidade, uma escola).
   Jamais restrinja a consulta aos itens que apareceram no contexto — o que a
   busca trouxe nao e o que existe, e responder sobre um subconjunto como se
   fosse o todo e tao errado quanto inventar numero.
5. HONRE TODAS AS CONDICOES da pergunta. Se ela pede "X mas nao Y", as duas
   precisam valer ao mesmo tempo; nao devolva quem satisfaz so uma delas. Se
   nada satisfizer, responda "nenhum" — lista aproximada para uma condicao que
   ninguem cumpre e resposta errada com aparencia de resposta certa.
6. NAO SUBSTITUA A PERGUNTA. Se voce nao tem o dado pedido, diga isso — nao
   entregue um conjunto parecido no lugar. Responder "acerto por pergunta" a
   quem perguntou "acerto por posicao na partida" e entregar outra coisa com
   aparencia de resposta.
7. NAO PROMETA CONSULTA QUE NAO EXISTE. So ofereca buscar algo se houver
   ferramenta para isso na lista. Dizer "posso consultar, quer que eu busque?"
   sem ter a ferramenta e prometer o que nao vai acontecer.
8. Se a pergunta estiver fora do escopo da plataforma, diga isso. Nao improvise
   com conhecimento geral.

Como responder:

- Em portugues do Brasil, com markdown quando ajudar. Seja direto: quem le
  conhece a plataforma.
- Pediu visual, chama gerar_grafico. Se a pergunta trouxer "grafico", "heatmap",
  "mapa de calor", "mostra", "visualiza", "compara" ou pedir cruzamento entre
  duas dimensoes, use gerar_grafico — NAO a consulta de dados crua. Ela chama a
  consulta por baixo e devolve os mesmos numeros, entao nao ha nada a perder.
  Escolha a forma: 'matriz' para cruzar duas dimensoes (escolaridade x ODS),
  'barras_agrupadas' para duas medidas da mesma unidade (cadastradas x
  respondidas), 'barras' para o resto.
- NUNCA diga que um grafico foi gerado, esta disponivel ou pode ser visualizado
  se voce nao chamou gerar_grafico nesta resposta. Sem essa chamada nao existe
  grafico nenhum na tela, e a frase seria falsa.
- Quando houver grafico, nao descreva barra por barra nem repita a tabela no
  texto — o grafico ja mostra. Comente o padrao, o destaque e a ressalva.
- O grafico e desenhado PELA INTERFACE, acima do seu texto. Nunca escreva
  markdown de imagem, link, data:image, base64 nem desenho em ASCII: nao existe
  imagem para embutir, e o resultado seria uma imagem quebrada na tela. Escreva
  como se o leitor ja estivesse vendo o grafico.
- Para EXECUTAR algo (aprovar/rejeitar sugestao, ativar/desativar, criar ou
  editar pergunta), use propor_acao. Ela nao executa: monta uma proposta que o
  administrador confirma na tela. Explique em texto o que voce propos e por que
  — nunca diga que a acao foi feita, aprovada ou salva: ate o clique dele, nada
  aconteceu.
- SEMPRE inclua o IDENTIFICADOR ao citar algo sobre o que se pode agir: "sugestao
  3 (EEB Frei Godofredo)", "pergunta 18", "escola 10". Sem o id, nem o
  administrador nem voce mesmo na proxima mensagem tem como saber de qual item
  se trata — e agir sobre o item errado e pior do que nao agir. Vale
  especialmente quando dois itens tem nomes parecidos.
- Ao propor edicao de pergunta que ja tem respostas, diga isso na sua resposta,
  nao so no aviso da proposta. Mudar o enunciado faz os dados ja coletados se
  referirem a um texto que nao existe mais.
- Termine numa ACAO POSSIVEL sempre que houver uma. Diga o que fazer e em qual
  tela — por exemplo, revisar o enunciado em /admin/perguntas, ou aprovar a
  escola em /admin/escolas.
- Ao apresentar numero, informe sempre o N. Se o N for pequeno, diga
  explicitamente que ainda nao da para decidir, em vez de apresentar o
  percentual como se fosse solido.
- Traga a ressalva pertinente junto do dado. Recomendar que se desative uma
  pergunta com base em 3 respostas causa dano real ao levantamento.
`.trim();

/**
 * Instrucao da chamada que gera as respostas rapidas.
 *
 * E uma chamada separada, curta e com a ferramenta FORCADA, por um motivo
 * medido: pedir no prompt principal nao funciona. O modelo termina com texto e
 * simplesmente nao faz a chamada extra, por mais explicita que seja a regra —
 * uma vez que ele tem a resposta, ele responde. Forcar a ferramenta torna
 * deterministico o que a instrucao nao conseguia garantir.
 *
 * O custo e uma chamada pequena por mensagem: so a pergunta e a resposta, sem
 * contexto recuperado nem historico.
 */
const INSTRUCAO_DE_OPCOES = `
Voce recebe uma pergunta feita ao painel administrativo do Desafio ODS e a
resposta que foi dada. Sugira de 2 a 4 proximos passos que o administrador
provavelmente vai querer, como frases curtas escritas NA VOZ DELE — sao o texto
que sera enviado quando ele clicar.

CADA OPCAO PRECISA SER AUTOSSUFICIENTE. O texto do botao vira a mensagem
enviada, sozinha, sem que o clique carregue nenhum outro contexto — entao ela
tem de conter o IDENTIFICADOR do que sera afetado. Escreva "Aprovar a sugestao 3
(EEB Frei Godofredo)", nunca "Aprovar a sugestao"; "Desativar a pergunta 18",
nunca "Desativar essa pergunta". Sem o id, quem for executar precisa adivinhar
de qual item se trata — e vai errar.

Boas opcoes sao acionaveis e especificas: "Aprovar a sugestao 3 para Ensino
Medio", "Vincular a sugestao 3 a escola 10", "Desativar a pergunta 18",
"Ver desempenho por escola". Evite generico ("Saber mais", "Continuar") e evite
repetir o que a resposta ja entregou.

SO OFERECA O QUE A PLATAFORMA SABE FAZER. A lista de capacidades vem junto: se
o proximo passo que voce pensou nao corresponde a nenhuma delas, nao ofereca.
Botao que ao ser clicado responde "nao existe ferramenta para isso" e pior que
botao nenhum — promete algo que nao acontece.

Se a resposta esta completa e nao ha proximo passo obvio — ou se ela foi uma
recusa por falta de dado —, devolva uma lista VAZIA.
`.trim();

/**
 * Orquestra uma pergunta: recupera contexto, monta o prompt, roda o laco de
 * ferramentas e persiste. Ver tcc-docs/specs/06-chat-ia.md.
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
        graficos: resposta.graficos.length ? resposta.graficos : null,
        acoes: resposta.acoes.length ? resposta.acoes : null,
        sugestoes: resposta.sugestoes.length ? resposta.sugestoes : null,
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
    const graficos: EspecificacaoDeGrafico[] = [];
    const acoes: AcaoProposta[] = [];
    // Retornos crus das consultas, para a geracao de respostas rapidas. O
    // texto da resposta nem sempre cita os ids, e o botao precisa deles.
    const retornos: string[] = [];

    const trechos = await this.retriever.recuperar(pergunta);
    passos.push({
      tipo: 'recuperacao',
      trechos: trechos.map((t) => ({
        fonte: t.fonte,
        titulo: t.titulo,
        similaridade: Number(t.similaridade.toFixed(3)),
      })),
    });

    const mensagens: ChatCompletionMessageParam[] = [
      { role: 'system', content: INSTRUCAO_DO_SISTEMA },
      // Dois blocos com papeis distintos, e nao um "contexto" unico: ver a
      // explicacao em rag/contexto.ts.
      ...mensagensDeContexto(trechos).map((content): ChatCompletionMessageParam => ({
        role: 'system',
        content,
      })),
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
          graficos,
          acoes,
          sugestoes: await this.sugerirOpcoes(pergunta, escolha.content ?? '', retornos),
          tokensPrompt,
          tokensSaida,
        };
      }

      mensagens.push(escolha);
      for (const chamada of chamadas) {
        mensagens.push(await this.executarChamada(chamada, passos, graficos, acoes, retornos));
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
      graficos,
      acoes,
      sugestoes: [],
      tokensPrompt,
      tokensSaida,
    };
  }

  /**
   * Gera as respostas rapidas numa chamada propria, com a ferramenta forcada.
   *
   * Nunca derruba a resposta: se falhar, a mensagem vai sem botoes. Eles sao
   * conveniencia, e ficar sem eles e melhor que perder a resposta inteira.
   */
  private async sugerirOpcoes(
    pergunta: string,
    resposta: string,
    retornos: string[],
  ): Promise<string[]> {
    if (!resposta.trim()) return [];

    try {
      const conclusao = await this.openai.chat.completions.create({
        model: this.openai.modeloChat,
        messages: [
          { role: 'system', content: INSTRUCAO_DE_OPCOES },
          {
            role: 'system',
            content: `O assistente consegue fazer APENAS isto:\n${this.ferramentas.resumoDasCapacidades}`,
          },
          ...(retornos.length
            ? [
                {
                  role: 'system' as const,
                  content:
                    'Dados consultados para produzir a resposta. Tire DAQUI os identificadores ' +
                    `que os botoes precisam carregar:\n${retornos.join('\n')}`,
                },
              ]
            : []),
          { role: 'user', content: `Pergunta: ${pergunta}\n\nResposta dada:\n${resposta}` },
        ],
        tools: this.ferramentas.declaracoes.filter((d) => d.function.name === 'oferecer_opcoes'),
        tool_choice: { type: 'function', function: { name: 'oferecer_opcoes' } },
      });

      const chamada = conclusao.choices[0]?.message?.tool_calls?.[0];
      if (!chamada || chamada.type !== 'function') return [];

      const retorno = (await this.ferramentas.executar(
        'oferecer_opcoes',
        JSON.parse(chamada.function.arguments || '{}') as Record<string, unknown>,
      )) as { opcoes?: string[] };

      return retorno.opcoes ?? [];
    } catch (erro) {
      this.logger.warn(
        `Falha ao gerar respostas rapidas: ${erro instanceof Error ? erro.message : String(erro)}`,
      );
      return [];
    }
  }

  /** Executa uma chamada de ferramenta e devolve a mensagem de retorno. */
  private async executarChamada(
    chamada: ChatCompletionMessageToolCall,
    passos: PassoDoAssistente[],
    graficos: EspecificacaoDeGrafico[],
    acoes: AcaoProposta[],
    retornos: string[],
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

      // A ferramenta de grafico devolve { grafico, dados }: o grafico e anexado
      // a mensagem e o modelo recebe os dados para comentar. Os numeros que ele
      // le sao os MESMOS que foram plotados.
      const comGrafico = retorno as { grafico?: EspecificacaoDeGrafico | null } | null;
      if (comGrafico && typeof comGrafico === 'object' && comGrafico.grafico) {
        graficos.push(comGrafico.grafico);
      }

      // Acao PROPOSTA — anexada a mensagem para a interface pedir confirmacao.
      // Nada foi executado aqui.
      const comAcao = retorno as { acao?: AcaoProposta } | null;
      if (comAcao && typeof comAcao === 'object' && comAcao.acao) {
        acoes.push(comAcao.acao);
      }

      const serializado = JSON.stringify(retorno);
      // Truncado: e um indice de identificadores, nao o payload inteiro.
      retornos.push(`${nome}: ${serializado.slice(0, 700)}`);
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
