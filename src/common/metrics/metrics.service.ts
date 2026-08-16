import { Injectable, OnModuleInit } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Registry } from 'prom-client';

/**
 * Registrador de metricas Prometheus. Um Registry proprio evita colisao com
 * outros pacotes que usem o registrador global do prom-client.
 */
@Injectable()
export class MetricsService implements OnModuleInit {
  readonly registry = new Registry();

  readonly httpRequestsTotal = new Counter({
    name: 'http_requests_total',
    help: 'Total de requisicoes HTTP processadas',
    labelNames: ['method', 'route', 'status_code'] as const,
    registers: [this.registry],
  });

  readonly httpRequestDurationSeconds = new Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duracao das requisicoes HTTP em segundos',
    labelNames: ['method', 'route', 'status_code'] as const,
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [this.registry],
  });

  onModuleInit(): void {
    // Metricas padrao do prom-client (event loop, GC, memoria, CPU do processo).
    // NAO aplicar 'prefix' aqui: as metricas ja vem com nomes canonicos
    // (process_* para POSIX, nodejs_* para V8/libuv) — casam com dashboards
    // publicos como o "NodeJS Application Dashboard".
    collectDefaultMetrics({ register: this.registry });
  }

  async render(): Promise<string> {
    return this.registry.metrics();
  }

  contentType(): string {
    return this.registry.contentType;
  }
}
