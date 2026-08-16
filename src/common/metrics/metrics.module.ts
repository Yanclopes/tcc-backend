import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsController } from './metrics.controller';
import { MetricsInterceptor } from './metrics.interceptor';
import { MetricsService } from './metrics.service';

/**
 * Metricas Prometheus. Expoe:
 *  - GET /metrics (fora do prefixo /api, para scrape padrao).
 *  - Interceptor global que conta requests + histograma de duracao.
 *  - Metricas default do Node (event loop, GC, memoria).
 */
@Module({
  controllers: [MetricsController],
  providers: [MetricsService, { provide: APP_INTERCEPTOR, useClass: MetricsInterceptor }],
  exports: [MetricsService],
})
export class MetricsModule {}
