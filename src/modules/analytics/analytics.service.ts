import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { MvAcertoPorOds } from './entities/mv-acerto-por-ods.entity';
import { MvCalibragemPerguntas } from './entities/mv-calibragem-perguntas.entity';
import { MvDesempenhoPorEscolaridade } from './entities/mv-desempenho-por-escolaridade.entity';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(MvAcertoPorOds)
    private readonly acertoPorOdsRepo: Repository<MvAcertoPorOds>,
    @InjectRepository(MvDesempenhoPorEscolaridade)
    private readonly desempenhoRepo: Repository<MvDesempenhoPorEscolaridade>,
    @InjectRepository(MvCalibragemPerguntas)
    private readonly calibragemRepo: Repository<MvCalibragemPerguntas>,
    private readonly dataSource: DataSource,
  ) {}

  acertoPorOds(): Promise<MvAcertoPorOds[]> {
    return this.acertoPorOdsRepo.find({ order: { goalNumber: 'ASC' } });
  }

  desempenhoPorEscolaridade(): Promise<MvDesempenhoPorEscolaridade[]> {
    return this.desempenhoRepo.find({ order: { educationLevelId: 'ASC', goalId: 'ASC' } });
  }

  calibragemPerguntas(flag?: string): Promise<MvCalibragemPerguntas[]> {
    return this.calibragemRepo.find({
      where: flag ? { flag } : {},
      order: { taxaAcerto: 'DESC' },
    });
  }

  /**
   * Recalcula as materialized views. Usa CONCURRENTLY (exige indice unico, ja
   * criado nas migrations) para nao bloquear leituras durante o refresh.
   */
  async refreshAll(): Promise<{ refreshed: string[] }> {
    const views = [
      'mv_acerto_por_ods',
      'mv_desempenho_por_escolaridade',
      'mv_calibragem_perguntas',
    ];
    for (const view of views) {
      await this.dataSource.query(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${view};`);
    }
    return { refreshed: views };
  }
}
