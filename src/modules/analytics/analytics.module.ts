import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { MvAcertoPorOds } from './entities/mv-acerto-por-ods.entity';
import { MvCalibragemPerguntas } from './entities/mv-calibragem-perguntas.entity';
import { MvDesempenhoPorEscolaridade } from './entities/mv-desempenho-por-escolaridade.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MvAcertoPorOds,
      MvDesempenhoPorEscolaridade,
      MvCalibragemPerguntas,
    ]),
  ],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
