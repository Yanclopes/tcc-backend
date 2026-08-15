import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ranking } from './entities/ranking.entity';

/** Ids dos modos de jogo — bate com game_difficulty.id do seed. */
export const RANKING_MODES = ['quick', 'classic', 'endless', 'survival'] as const;
export type RankingMode = (typeof RANKING_MODES)[number];

@Injectable()
export class RankingService {
  constructor(
    @InjectRepository(Ranking)
    private readonly rankingRepo: Repository<Ranking>,
  ) {}

  /**
   * Top N pontuacoes: uma linha por usuario (sua melhor partida). Se `mode` for
   * informado, filtra pelo modo de jogo (ex.: 'quick', 'survival').
   */
  async findTop(limit = 10, mode?: RankingMode): Promise<Ranking[]> {
    const qb = this.rankingRepo
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.user', 'u')
      .innerJoin('r.game', 'g');

    if (mode) {
      qb.where('g.difficulty = :mode', { mode });
    }

    // Puxa mais registros que o limit — precisa deduplicar por usuario depois.
    // Para escala do TCC (centenas de partidas), buscar ate 5x o limit e desduplicar
    // em memoria e suficiente. Se algum dia crescer, migrar para DISTINCT ON (SQL raw).
    const rows = await qb
      .orderBy('r.score', 'DESC')
      .addOrderBy('r.completedAt', 'ASC')
      .take(Math.max(limit * 5, 100))
      .getMany();

    const seen = new Set<number>();
    const dedup: Ranking[] = [];
    for (const r of rows) {
      const userId = r.user?.id;
      if (userId != null && !seen.has(userId)) {
        seen.add(userId);
        dedup.push(r);
        if (dedup.length >= limit) break;
      }
    }
    return dedup;
  }

  /** Historico completo de partidas de um usuario (todas as entradas, sem dedup). */
  findByUser(userId: number): Promise<Ranking[]> {
    return this.rankingRepo.find({
      where: { user: { id: userId } },
      order: { score: 'DESC' },
    });
  }
}
