import { Injectable, Logger } from '@nestjs/common';
import type { ChatCompletionFunctionTool } from 'openai/resources/chat/completions';
import { AnalyticsService } from '../../analytics/analytics.service';
import { DashboardService } from '../../dashboard/dashboard.service';
import { DashboardFilterDto } from '../../dashboard/dto/dashboard-filter.dto';
import { RegionLevel } from '../../dashboard/dto/region-level.enum';

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
  ) {}

  /** Declaracoes enviadas ao modelo. */
  get declaracoes(): ChatCompletionFunctionTool[] {
    return [
      ferramentaComFiltros(
        'visao_geral',
        'KPIs gerais do levantamento: total de respostas, taxa de acerto, participantes, ' +
          'tempo medio. Use quando a pergunta for ampla ou pedir um panorama.',
      ),
      ferramentaComFiltros(
        'desempenho_por_ods',
        'Taxa de acerto por ODS, calculada no momento da consulta. Use para comparar ' +
          'objetivos entre si ou achar o ODS com melhor/pior desempenho.',
      ),
      ferramentaComFiltros(
        'desempenho_por_regiao',
        'Taxa de acerto por estado, cidade ou escola. Informe "level" para escolher a ' +
          'granularidade do recorte.',
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
        'Taxa de acerto e tempo medio por pergunta. Use para achar perguntas dificeis, ' +
          'faceis demais ou lentas.',
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
        'Perguntas classificadas por qualidade de calibragem. Use para responder quais ' +
          'perguntas estao faceis demais, dificeis demais ou com amostra insuficiente.',
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
