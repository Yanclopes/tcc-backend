import { Injectable, Logger } from '@nestjs/common';
import type { ChatCompletionFunctionTool } from 'openai/resources/chat/completions';
import { AnalyticsService } from '../../analytics/analytics.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { DashboardFilterDto } from '../../dashboard/dto/dashboard-filter.dto';
import { RegionLevel } from '../../dashboard/dto/region-level.enum';
import { AcoesService } from '../acoes/acoes.service';
import { AcaoProposta, EspecificacaoDeGrafico } from '../chat.types';
import {
  FONTES_AGRUPAVEIS,
  FONTES_DE_MATRIZ,
  FONTES_PLOTAVEIS,
  GraficoIndisponivelError,
  montarGrafico,
} from '../graficos/graficos';

/**
 * As ferramentas que o assistente pode acionar. Ver .specs/06-chat-ia.md.
 *
 * Por que existem: embedding e estatico e congela na data da indexacao. Numero
 * precisa ser do momento da pergunta, senao o assistente responde taxa de
 * acerto velha com confianca — pior do que nao responder.
 *
 * Todas reaproveitam DashboardService e AnalyticsService. Nenhuma query nova e
 * escrita aqui.
 */

/** Filtros aceitos por todas as ferramentas que recortam o levantamento. */
const PROPRIEDADES_DE_FILTRO = {
  goalNumber: { type: 'integer', description: 'Numero canonico do ODS (1 a 17).' },
  stateId: { type: 'integer', description: 'Id do estado.' },
  cityId: { type: 'integer', description: 'Id da cidade.' },
  schoolId: { type: 'integer', description: 'Id da escola.' },
  educationLevelId: { type: 'integer', description: 'Id do nivel de escolaridade.' },
  from: { type: 'string', description: 'Data inicial, ISO 8601 (ex.: 2026-01-01).' },
  to: { type: 'string', description: 'Data final, ISO 8601.' },
} as const;

/** Declara uma ferramenta sem parametros. */
function ferramenta(
  nome: string,
  descricao: string,
  propriedades: Record<string, unknown> = {},
): ChatCompletionFunctionTool {
  return {
    type: 'function',
    function: {
      name: nome,
      description: descricao,
      parameters: { type: 'object', properties: propriedades, additionalProperties: false },
    },
  };
}

/** Declara uma ferramenta que aceita os recortes do levantamento. */
function ferramentaComFiltros(
  nome: string,
  descricao: string,
  extras: Record<string, unknown> = {},
): ChatCompletionFunctionTool {
  return ferramenta(nome, descricao, { ...PROPRIEDADES_DE_FILTRO, ...extras });
}

/**
 * Chaves que jamais podem sair da aplicacao para a OpenAI.
 *
 * Guard de LGPD: a plataforma coleta dados de estudantes, possivelmente
 * menores, e enviar qualquer coisa a OpenAI e transferencia internacional. As
 * ferramentas foram escritas para devolver so agregados, mas um refactor futuro
 * em DashboardService poderia expor campo individual sem ninguem perceber. Este
 * guard existe para esse dia.
 */
const CAMPOS_PROIBIDOS = [
  'email',
  'password',
  'passwordHash',
  'name',
  'nome',
  'userId',
  'user_id',
  'cpf',
  'telefone',
  'phone',
];

@Injectable()
export class FerramentasService {
  private readonly logger = new Logger(FerramentasService.name);

  constructor(
    private readonly dashboard: DashboardService,
    private readonly analytics: AnalyticsService,
    private readonly acoes: AcoesService,
  ) {}

  /** Declaracoes enviadas ao modelo. */
  get declaracoes(): ChatCompletionFunctionTool[] {
    return [
      ferramentaComFiltros(
        'visao_geral',
        'KPIs gerais do levantamento: total de respostas, taxa de acerto, participantes, ' +
          'tempo medio, total de partidas e quantas foram FINALIZADAS. A diferenca entre as ' +
          'duas ultimas e o abandono. Use quando a pergunta for ampla, pedir panorama ou ' +
          'falar de conclusao/abandono de partidas.',
      ),
      ferramentaComFiltros(
        'desempenho_por_ods',
        'Taxa de acerto por ODS, calculada no momento da consulta. Traz tambem o total ' +
          'de respostas (N) e quantas perguntas distintas RECEBERAM RESPOSTA (nao e o numero de ' +
          'perguntas cadastradas — para isso use cobertura_do_catalogo). SEM FILTRO ' +
          'devolve TODOS os ODS — use assim para comparar objetivos ou achar o melhor/pior. ' +
          'So informe goalNumber se o usuario perguntou de um ODS especifico.',
      ),
      ferramentaComFiltros(
        'desempenho_por_regiao',
        'Taxa de acerto por estado, cidade ou escola. Informe "level" para escolher a ' +
          'granularidade. SEM FILTRO devolve TODAS as regioes daquele nivel — e assim que ' +
          'se descobre onde a participacao nao chegou.',
        {
          level: {
            type: 'string',
            enum: Object.values(RegionLevel),
            description: 'Granularidade: state, city ou school. Padrao: state.',
          },
        },
      ),
      ferramentaComFiltros(
        'desempenho_por_pergunta',
        'Taxa de acerto e tempo medio por pergunta. SEM FILTRO devolve TODAS as perguntas ' +
          'do catalogo — e assim que se descobre quais revisar, desativar ou quais estao ' +
          'lentas. Nao filtre por ODS a menos que o usuario tenha delimitado.',
      ),
      ferramentaComFiltros(
        'gerar_grafico',
        'Desenha um grafico a partir de uma das consultas de dados. Use quando a resposta ' +
          'ficar melhor visual — comparar ODS, regioes, escolas ou perguntas entre si. ' +
          'Voce escolhe a FONTE e a METRICA; os numeros e os rotulos vem da consulta real, ' +
          'voce nao os informa. Chame no lugar da consulta, nao alem dela: a ferramenta ja ' +
          'devolve os dados junto do grafico. Escolha a FORMA conforme o dado. ' +
          'Nao existe grafico de linha nem serie ' +
          'temporal — nenhuma consulta devolve evolucao no tempo.',
        {
          fonte: {
            type: 'string',
            enum: [...new Set([...Object.keys(FONTES_PLOTAVEIS), ...FONTES_DE_MATRIZ])],
            description: 'Qual consulta alimenta o grafico.',
          },
          forma: {
            type: 'string',
            enum: ['barras', 'matriz', 'barras_agrupadas'],
            description:
              "'barras' (padrao) compara UMA medida entre categorias. 'matriz' cruza DUAS " +
              `dimensoes num heatmap — so para: ${FONTES_DE_MATRIZ.join(', ')}; use quando a ` +
              'pergunta cruzar escolaridade com ODS. ' +
              "'barras_agrupadas' poe duas medidas da mesma unidade lado a lado — so para: " +
              `${FONTES_AGRUPAVEIS.join(', ')}; use para contrastar cadastrado x respondido.`,
          },
          metrica: {
            type: 'string',
            enum: ['taxa', 'respostas', 'tempo', 'perguntas', 'alunos'],
            description:
              'O que medir. Nem toda fonte aceita todas: se a metrica nao existir para a ' +
              'fonte, a padrao e usada.',
          },
          titulo: {
            type: 'string',
            description: 'Titulo curto e descritivo do grafico, em portugues.',
          },
          level: {
            type: 'string',
            enum: Object.values(RegionLevel),
            description: 'Granularidade, quando a fonte for regional ou de cobertura.',
          },
        },
      ),
      ferramenta(
        'propor_acao',
        'PROPOE uma acao administrativa para o administrador confirmar. Nao executa nada: ' +
          'devolve uma proposta que aparece na tela com botao de confirmar. Use quando o ' +
          'administrador pedir para aprovar/rejeitar sugestao de escola, ativar/desativar, ' +
          'criar ou editar pergunta. Sempre explique em texto o que esta propondo e por que.',
        {
          tipo: {
            type: 'string',
            enum: [
              'aprovar_sugestao_escola',
              'vincular_sugestao_escola',
              'rejeitar_sugestao_escola',
              'definir_pergunta_ativa',
              'criar_pergunta',
              'editar_pergunta',
            ],
            description: 'Qual acao propor.',
          },
          sugestaoId: { type: 'integer', description: 'Id da sugestao de escola.' },
          escolaId: {
            type: 'integer',
            description: 'Id da escola existente, para vincular_sugestao_escola.',
          },
          escolaridadeIds: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Niveis atendidos pela escola, para aprovar_sugestao_escola.',
          },
          motivo: {
            type: 'string',
            description: 'Motivo da rejeicao. O aluno le este texto, entao escreva com cuidado.',
          },
          perguntaId: {
            type: 'integer',
            description: 'Id da pergunta a ativar, desativar ou editar.',
          },
          ativa: { type: 'boolean', description: 'true ativa, false desativa.' },
          enunciado: { type: 'string', description: 'Texto da pergunta.' },
          odsNumero: { type: 'integer', description: 'Numero canonico do ODS (1 a 17).' },
          alternativas: {
            type: 'array',
            items: { type: 'string' },
            description: 'Exatamente 4 alternativas distintas.',
          },
          indiceCorreto: {
            type: 'integer',
            description: 'Indice (0 a 3) da alternativa correta dentro de alternativas.',
          },
          dificuldade: { type: 'integer', description: 'Dificuldade de 1 a 5.' },
          fonte: { type: 'string', description: 'Fonte bibliografica da pergunta.' },
        },
      ),
      ferramenta(
        'cobertura_do_catalogo',
        'Os 17 ODS com quantas perguntas cada um tem CADASTRADAS, quantas ativas, quantas ' +
          'ja receberam resposta e o total de respostas — INCLUSIVE os ODS que nao tem ' +
          'nenhuma pergunta. Use para "algum ODS esta sem pergunta", "onde falta conteudo" ' +
          'ou "qual ODS precisa de mais perguntas". NAO use desempenho_por_ods para isso: ' +
          'aquela consulta parte das respostas e omite os ODS sem nenhuma resposta.',
      ),
      ferramenta(
        'cobertura_geografica',
        'TODAS as cidades ou escolas do catalogo com quantos usuarios se cadastraram, ' +
          'quantas partidas e quantas respostas — INCLUSIVE as que tem zero. Use sempre ' +
          'que a pergunta for sobre onde a participacao nao chegou, onde divulgar ou quem ' +
          'esta parado. NAO use desempenho_por_regiao para isso: aquela consulta parte das ' +
          'respostas e omite justamente quem nao participou.',
        {
          level: {
            type: 'string',
            enum: [RegionLevel.CITY, RegionLevel.SCHOOL],
            description: 'city ou school. Padrao: school.',
          },
        },
      ),
      ferramenta(
        'acerto_por_ods_consolidado',
        'Taxa de acerto por ODS a partir da materialized view consolidada. ATENCAO: ' +
          'reflete o ultimo refresh, nao o instante da consulta. Para o dado mais recente ' +
          'prefira desempenho_por_ods.',
      ),
      ferramenta(
        'desempenho_por_escolaridade',
        'Cruzamento de escolaridade com ODS (materialized view). Base da analise A03 ' +
          '(heatmap escolaridade x ODS).',
      ),
      ferramenta(
        'calibragem_perguntas',
        'Perguntas classificadas por qualidade de calibragem. SEM o parametro flag devolve ' +
          'TODAS as perguntas classificadas de uma vez — prefira assim para triar o catalogo, ' +
          'em vez de consultar uma flag por vez.',
        {
          flag: {
            type: 'string',
            enum: ['muito_facil', 'muito_dificil', 'ok', 'amostra_insuficiente'],
            description: 'Filtra por uma classificacao especifica.',
          },
        },
      ),
    ];
  }

  /** Executa uma ferramenta pelo nome, com os argumentos que o modelo enviou. */
  async executar(nome: string, argumentos: Record<string, unknown>): Promise<unknown> {
    const filtro = this.montarFiltro(argumentos);

    switch (nome) {
      case 'visao_geral':
        return this.sanitizar(await this.dashboard.overview(filtro));
      case 'desempenho_por_ods':
        return this.sanitizar(await this.dashboard.byOds(filtro));
      case 'desempenho_por_regiao': {
        const nivel = this.lerNivel(argumentos.level);
        return this.sanitizar(await this.dashboard.byRegion(filtro, nivel));
      }
      case 'desempenho_por_pergunta':
        return this.sanitizar(await this.dashboard.byQuestion(filtro));
      case 'gerar_grafico':
        return this.gerarGrafico(argumentos);
      case 'propor_acao':
        return { acao: await this.proporAcao(argumentos) };
      case 'cobertura_do_catalogo':
        return this.sanitizar(await this.dashboard.coberturaPorOds());
      case 'cobertura_geografica':
        return this.sanitizar(
          await this.dashboard.coberturaGeografica(
            argumentos.level === RegionLevel.CITY ? RegionLevel.CITY : RegionLevel.SCHOOL,
          ),
        );
      case 'acerto_por_ods_consolidado':
        return this.sanitizar(await this.analytics.acertoPorOds());
      case 'desempenho_por_escolaridade':
        return this.sanitizar(await this.analytics.desempenhoPorEscolaridade());
      case 'calibragem_perguntas':
        return this.sanitizar(
          await this.analytics.calibragemPerguntas(
            typeof argumentos.flag === 'string' ? argumentos.flag : undefined,
          ),
        );
      default:
        throw new Error(`Ferramenta desconhecida: '${nome}'.`);
    }
  }

  /**
   * Executa a consulta pedida e devolve o grafico montado a partir dela.
   *
   * O modelo nao ve os numeros antes: ele escolhe a fonte, nos executamos. Isso
   * elimina a possibilidade de um grafico com valor inventado — que seria pior
   * que um texto inventado, porque grafico tem aparencia de autoridade.
   */
  private async gerarGrafico(argumentos: Record<string, unknown>): Promise<unknown> {
    const fonte = typeof argumentos.fonte === 'string' ? argumentos.fonte : '';
    const formasValidas = ['barras', 'matriz', 'barras_agrupadas'] as const;
    const forma = formasValidas.find((f) => f === argumentos.forma) ?? 'barras';

    if (!FONTES_PLOTAVEIS[fonte] && !FONTES_DE_MATRIZ.includes(fonte)) {
      throw new Error(
        `Fonte '${fonte}' nao pode virar grafico. Disponiveis: ` +
          `${Object.keys(FONTES_PLOTAVEIS).join(', ')}.`,
      );
    }

    const linhas = await this.executar(fonte, argumentos);

    let grafico: EspecificacaoDeGrafico;
    try {
      grafico = montarGrafico({
        fonte,
        linhas,
        metrica: typeof argumentos.metrica === 'string' ? argumentos.metrica : undefined,
        titulo: typeof argumentos.titulo === 'string' ? argumentos.titulo : undefined,
        forma,
      });
    } catch (erro) {
      if (erro instanceof GraficoIndisponivelError) {
        // Devolve como retorno normal (nao excecao) para o modelo explicar em
        // texto na mesma volta, em vez de tentar de novo.
        return { grafico: null, motivo: erro.message, dados: linhas };
      }
      throw erro;
    }

    // Os dados acompanham o grafico: o modelo precisa deles para comentar a
    // resposta, e sao os MESMOS numeros que foram plotados.
    return { grafico, dados: linhas };
  }

  /**
   * Monta a proposta. NAO executa — ver .specs/06-chat-ia.md.
   *
   * Cada erro de validacao volta como excecao, que o laco transforma em retorno
   * de ferramenta: o modelo le a mensagem e corrige na proxima volta em vez de
   * a requisicao inteira falhar.
   */
  private async proporAcao(argumentos: Record<string, unknown>): Promise<AcaoProposta> {
    const inteiro = (valor: unknown, campo: string): number => {
      const n = typeof valor === 'string' ? Number.parseInt(valor, 10) : valor;
      if (typeof n !== 'number' || !Number.isFinite(n)) {
        throw new Error(`'${campo}' e obrigatorio e precisa ser um numero.`);
      }
      return n;
    };
    const listaDeTextos = (valor: unknown, campo: string): string[] => {
      if (!Array.isArray(valor)) throw new Error(`'${campo}' precisa ser uma lista de textos.`);
      return valor.map((item) => String(item));
    };

    switch (argumentos.tipo) {
      case 'aprovar_sugestao_escola':
        return this.acoes.aprovarSugestaoEscola(
          inteiro(argumentos.sugestaoId, 'sugestaoId'),
          Array.isArray(argumentos.escolaridadeIds)
            ? argumentos.escolaridadeIds.map((id) => inteiro(id, 'escolaridadeIds'))
            : [],
        );
      case 'vincular_sugestao_escola':
        return this.acoes.vincularSugestaoEscola(
          inteiro(argumentos.sugestaoId, 'sugestaoId'),
          inteiro(argumentos.escolaId, 'escolaId'),
        );
      case 'rejeitar_sugestao_escola':
        return this.acoes.rejeitarSugestaoEscola(
          inteiro(argumentos.sugestaoId, 'sugestaoId'),
          typeof argumentos.motivo === 'string' ? argumentos.motivo : '',
        );
      case 'definir_pergunta_ativa':
        return this.acoes.definirPerguntaAtiva(
          inteiro(argumentos.perguntaId, 'perguntaId'),
          argumentos.ativa === true,
        );
      case 'criar_pergunta':
        return this.acoes.criarPergunta({
          texto: typeof argumentos.enunciado === 'string' ? argumentos.enunciado : '',
          odsNumero: inteiro(argumentos.odsNumero, 'odsNumero'),
          alternativas: listaDeTextos(argumentos.alternativas, 'alternativas'),
          indiceCorreto: inteiro(argumentos.indiceCorreto, 'indiceCorreto'),
          dificuldade:
            argumentos.dificuldade !== undefined
              ? inteiro(argumentos.dificuldade, 'dificuldade')
              : undefined,
          fonte: typeof argumentos.fonte === 'string' ? argumentos.fonte : undefined,
        });
      case 'editar_pergunta':
        return this.acoes.editarPergunta({
          id: inteiro(argumentos.perguntaId, 'perguntaId'),
          texto: typeof argumentos.enunciado === 'string' ? argumentos.enunciado : undefined,
          alternativas: Array.isArray(argumentos.alternativas)
            ? listaDeTextos(argumentos.alternativas, 'alternativas')
            : undefined,
          indiceCorreto:
            argumentos.indiceCorreto !== undefined
              ? inteiro(argumentos.indiceCorreto, 'indiceCorreto')
              : undefined,
          dificuldade:
            argumentos.dificuldade !== undefined
              ? inteiro(argumentos.dificuldade, 'dificuldade')
              : undefined,
        });
      default:
        throw new Error(`Tipo de acao desconhecido: '${String(argumentos.tipo)}'.`);
    }
  }

  /** Converte os argumentos do modelo no DTO de filtro, ignorando o que nao serve. */
  private montarFiltro(argumentos: Record<string, unknown>): DashboardFilterDto {
    const filtro: DashboardFilterDto = {};
    const inteiro = (valor: unknown): number | undefined => {
      const n = typeof valor === 'string' ? Number.parseInt(valor, 10) : valor;
      return typeof n === 'number' && Number.isFinite(n) ? n : undefined;
    };

    filtro.goalNumber = inteiro(argumentos.goalNumber);
    filtro.stateId = inteiro(argumentos.stateId);
    filtro.cityId = inteiro(argumentos.cityId);
    filtro.schoolId = inteiro(argumentos.schoolId);
    filtro.educationLevelId = inteiro(argumentos.educationLevelId);
    if (typeof argumentos.from === 'string') filtro.from = argumentos.from;
    if (typeof argumentos.to === 'string') filtro.to = argumentos.to;

    return filtro;
  }

  private lerNivel(valor: unknown): RegionLevel {
    const niveis = Object.values(RegionLevel) as string[];
    return typeof valor === 'string' && niveis.includes(valor)
      ? (valor as RegionLevel)
      : RegionLevel.STATE;
  }

  /**
   * Remove qualquer campo pessoal antes do payload virar prompt.
   *
   * Nao deveria encontrar nada — as ferramentas so chamam agregados. Se
   * encontrar, registra em WARN: e sinal de que algum servico passou a expor
   * dado individual e alguem precisa olhar.
   */
  private sanitizar<T>(payload: T): T {
    const encontrados = new Set<string>();

    const limpar = (valor: unknown): unknown => {
      if (Array.isArray(valor)) return valor.map(limpar);
      if (valor && typeof valor === 'object') {
        const saida: Record<string, unknown> = {};
        for (const [chave, item] of Object.entries(valor as Record<string, unknown>)) {
          if (CAMPOS_PROIBIDOS.includes(chave)) {
            encontrados.add(chave);
            continue;
          }
          saida[chave] = limpar(item);
        }
        return saida;
      }
      return valor;
    };

    const limpo = limpar(payload) as T;
    if (encontrados.size > 0) {
      this.logger.warn(
        `Guard de LGPD removeu campos pessoais do retorno de uma ferramenta: ` +
          `${[...encontrados].join(', ')}. Um servico agregado passou a expor dado individual — revisar.`,
      );
    }
    return limpo;
  }
}
