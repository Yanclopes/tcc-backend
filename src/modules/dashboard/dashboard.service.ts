import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { SelectQueryBuilder, Repository } from 'typeorm';
import { AppUser } from '../users/entities/app-user.entity';
import { City } from '../geo/entities/city.entity';
import { School } from '../geo/entities/school.entity';
import { Game } from '../game/entities/game.entity';
import { GameAnswer } from '../game/entities/game-answer.entity';
import { DashboardFilterDto } from './dto/dashboard-filter.dto';
import {
  DashboardOverviewDto,
  OdsBreakdownRowDto,
  QuestionBreakdownRowDto,
  SchoolCoverageRowDto,
  RegionBreakdownRowDto,
} from './dto/dashboard-responses.dto';
import { RegionLevel } from './dto/region-level.enum';

/** Converte valores agregados do Postgres (string/bigint/numeric) em number. */
const num = (value: unknown): number => (value == null ? 0 : Number(value));

/**
 * Consultas analiticas ao vivo sobre os dados reais de perguntas e respostas.
 * Tudo parte da tabela-fato game_answer, com joins ate a pergunta/ODS e ate o
 * participante (usuario -> escola -> cidade -> estado) para o recorte regional.
 *
 * Diferente das materialized views (visao consolidada), aqui as consultas sao
 * dinamicas e filtraveis, servindo ao dashboard interativo do administrador.
 */
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(GameAnswer)
    private readonly answerRepo: Repository<GameAnswer>,
  ) {}

  /** Monta a query base (joins + filtros) sobre game_answer. */
  private base(filter: DashboardFilterDto): SelectQueryBuilder<GameAnswer> {
    const qb = this.answerRepo
      .createQueryBuilder('ga')
      .innerJoin('ga.question', 'q')
      .innerJoin('q.goal', 'g')
      .innerJoin('ga.game', 'gm')
      .leftJoin('gm.user', 'u')
      .leftJoin('u.school', 'sc')
      .leftJoin('sc.city', 'ci')
      .leftJoin('ci.state', 'st')
      .leftJoin('u.educationLevel', 'el');

    if (filter.goalNumber) {
      qb.andWhere('g.number = :goalNumber', { goalNumber: filter.goalNumber });
    }
    if (filter.schoolId) {
      qb.andWhere('sc.id = :schoolId', { schoolId: filter.schoolId });
    }
    if (filter.cityId) {
      qb.andWhere('ci.id = :cityId', { cityId: filter.cityId });
    }
    if (filter.stateId) {
      qb.andWhere('st.id = :stateId', { stateId: filter.stateId });
    }
    if (filter.educationLevelId) {
      qb.andWhere('el.id = :educationLevelId', { educationLevelId: filter.educationLevelId });
    }
    if (filter.from) {
      qb.andWhere('ga.answered_at >= :from', { from: filter.from });
    }
    if (filter.to) {
      qb.andWhere('ga.answered_at <= :to', { to: filter.to });
    }
    return qb;
  }

  /** Indicadores gerais (KPIs) do levantamento. */
  async overview(filter: DashboardFilterDto): Promise<DashboardOverviewDto> {
    const row = await this.base(filter)
      .select('COUNT(ga.id)', 'total_respostas')
      .addSelect('COUNT(*) FILTER (WHERE ga.is_correct)', 'total_acertos')
      .addSelect('ROUND(AVG((ga.is_correct)::int), 4)', 'taxa_acerto')
      .addSelect('ROUND(AVG(ga.response_time_ms))', 'tempo_medio_ms')
      .addSelect('COUNT(DISTINCT ga.game)', 'total_partidas')
      .addSelect('COUNT(DISTINCT u.id)', 'total_participantes')
      .getRawOne<Record<string, string>>();

    return {
      totalRespostas: num(row?.total_respostas),
      totalAcertos: num(row?.total_acertos),
      taxaAcerto: num(row?.taxa_acerto),
      tempoMedioMs: num(row?.tempo_medio_ms),
      totalPartidas: num(row?.total_partidas),
      totalParticipantes: num(row?.total_participantes),
    };
  }

  /** Desempenho por ODS. */
  async byOds(filter: DashboardFilterDto): Promise<OdsBreakdownRowDto[]> {
    const rows = await this.base(filter)
      .select('g.number', 'goal_number')
      .addSelect('g.name', 'goal_name')
      .addSelect('COUNT(ga.id)', 'total_respostas')
      .addSelect('COUNT(*) FILTER (WHERE ga.is_correct)', 'total_acertos')
      // Quantas perguntas distintas sustentam a taxa. Um ODS com taxa baixa
      // apoiada numa unica pergunta mede aquela pergunta, nao o ODS — sem este
      // campo nao ha como o leitor (nem o assistente de IA) saber a diferenca.
      .addSelect('COUNT(DISTINCT ga.question)', 'perguntas_distintas')
      .addSelect('ROUND(AVG((ga.is_correct)::int), 4)', 'taxa_acerto')
      .addSelect('ROUND(AVG(ga.response_time_ms))', 'tempo_medio_ms')
      .groupBy('g.number')
      .addGroupBy('g.name')
      .orderBy('g.number', 'ASC')
      .getRawMany<Record<string, string>>();

    return rows.map((r) => ({
      goalNumber: num(r.goal_number),
      goalName: r.goal_name,
      totalRespostas: num(r.total_respostas),
      totalAcertos: num(r.total_acertos),
      perguntasDistintas: num(r.perguntas_distintas),
      taxaAcerto: num(r.taxa_acerto),
      tempoMedioMs: num(r.tempo_medio_ms),
    }));
  }

  /**
   * Desempenho por regiao (estado, cidade ou escola). Depende do participante
   * ter informado escola no perfil (dado opcional no cadastro).
   */
  async byRegion(filter: DashboardFilterDto, level: RegionLevel): Promise<RegionBreakdownRowDto[]> {
    const map: Record<RegionLevel, { idCol: string; labelCol: string }> = {
      [RegionLevel.STATE]: { idCol: 'st.id', labelCol: 'st.name' },
      [RegionLevel.CITY]: { idCol: 'ci.id', labelCol: 'ci.name' },
      [RegionLevel.SCHOOL]: { idCol: 'sc.id', labelCol: 'sc.name' },
    };
    const { idCol, labelCol } = map[level];

    const rows = await this.base(filter)
      .andWhere(`${idCol} IS NOT NULL`)
      .select(idCol, 'region_id')
      .addSelect(labelCol, 'region_label')
      .addSelect('COUNT(ga.id)', 'total_respostas')
      .addSelect('ROUND(AVG((ga.is_correct)::int), 4)', 'taxa_acerto')
      .addSelect('ROUND(AVG(ga.response_time_ms))', 'tempo_medio_ms')
      .addSelect('COUNT(DISTINCT u.id)', 'total_participantes')
      .groupBy(idCol)
      .addGroupBy(labelCol)
      .orderBy('total_respostas', 'DESC')
      .getRawMany<Record<string, string>>();

    return rows.map((r) => ({
      level,
      regionId: num(r.region_id),
      regionLabel: r.region_label,
      totalRespostas: num(r.total_respostas),
      taxaAcerto: num(r.taxa_acerto),
      tempoMedioMs: num(r.tempo_medio_ms),
      totalParticipantes: num(r.total_participantes),
    }));
  }

  /** Desempenho por pergunta (apoia a curadoria/calibragem do banco). */
  async byQuestion(filter: DashboardFilterDto): Promise<QuestionBreakdownRowDto[]> {
    const rows = await this.base(filter)
      .select('q.id', 'question_id')
      .addSelect('q.text', 'question_text')
      .addSelect('g.number', 'goal_number')
      .addSelect('COUNT(ga.id)', 'total_respostas')
      .addSelect('ROUND(AVG((ga.is_correct)::int), 4)', 'taxa_acerto')
      .addSelect('ROUND(AVG(ga.response_time_ms))', 'tempo_medio_ms')
      .groupBy('q.id')
      .addGroupBy('q.text')
      .addGroupBy('g.number')
      .orderBy('total_respostas', 'DESC')
      .getRawMany<Record<string, string>>();

    return rows.map((r) => ({
      questionId: num(r.question_id),
      questionText: r.question_text,
      goalNumber: num(r.goal_number),
      totalRespostas: num(r.total_respostas),
      taxaAcerto: num(r.taxa_acerto),
      tempoMedioMs: num(r.tempo_medio_ms),
    }));
  }

  /**
   * Cobertura por escola — TODAS as escolas do catalogo, inclusive as que nunca
   * tiveram uma partida.
   *
   * Por que nao da para usar byRegion para isto: aquela consulta parte de
   * `game_answer`, entao escola sem nenhuma resposta simplesmente nao aparece.
   * Perguntar "onde a participacao ainda nao chegou" com ela devolve o oposto
   * do que se pediu — as escolas que JA participaram. Aqui a varredura parte de
   * `school`, com LEFT JOIN, e o zero e uma linha legitima.
   *
   * A cobertura desigual entre municipios e a limitacao mais concreta do
   * levantamento, e a unica que se resolve com acao operacional.
   */
  async coberturaPorEscola(): Promise<SchoolCoverageRowDto[]> {
    const rows = await this.answerRepo.manager
      .createQueryBuilder()
      .select('sc.id', 'school_id')
      .addSelect('sc.name', 'school_name')
      .addSelect('ci.name', 'city_name')
      .addSelect('COUNT(DISTINCT u.id)', 'total_cadastrados')
      .addSelect('COUNT(DISTINCT gm.id)', 'total_partidas')
      .addSelect('COUNT(ga.id)', 'total_respostas')
      .from(School, 'sc')
      .leftJoin(City, 'ci', 'ci.id = sc.city')
      .leftJoin(AppUser, 'u', 'u.school = sc.id')
      .leftJoin(Game, 'gm', 'gm.user = u.id')
      .leftJoin(GameAnswer, 'ga', 'ga.game = gm.id')
      .groupBy('sc.id')
      .addGroupBy('sc.name')
      .addGroupBy('ci.name')
      // Sem participacao primeiro: e o que interessa a quem vai agir.
      .orderBy('total_respostas', 'ASC')
      .addOrderBy('sc.name', 'ASC')
      .getRawMany<Record<string, string>>();

    return rows.map((r) => ({
      schoolId: num(r.school_id),
      schoolName: r.school_name,
      cityName: r.city_name,
      totalCadastrados: num(r.total_cadastrados),
      totalPartidas: num(r.total_partidas),
      totalRespostas: num(r.total_respostas),
    }));
  }
}
