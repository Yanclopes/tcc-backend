import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ranking } from './entities/ranking.entity';

@Injectable()
export class RankingService {
  constructor(
    @InjectRepository(Ranking)
    private readonly rankingRepo: Repository<Ranking>,
  ) {}

  /** Top N pontuacoes (placar geral). */
  findTop(limit = 10): Promise<Ranking[]> {
    return this.rankingRepo.find({
      relations: { user: true },
      order: { score: 'DESC', completedAt: 'ASC' },
      take: limit,
    });
  }

  findByUser(userId: number): Promise<Ranking[]> {
    return this.rankingRepo.find({
      where: { user: { id: userId } },
      order: { score: 'DESC' },
    });
  }
}
