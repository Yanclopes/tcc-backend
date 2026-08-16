import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { MetricsService } from './metrics.service';

/**
 * Registra contagem e duracao de cada requisicao HTTP. Ignora /health e /metrics
 * para nao inflar as series com ruido operacional.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<{ method: string; route?: { path: string }; url: string }>();
    if (req.url === '/health' || req.url === '/metrics') return next.handle();

    const start = process.hrtime.bigint();
    return next.handle().pipe(
      tap({
        next: () => this.record(context, req, start),
        error: () => this.record(context, req, start),
      }),
    );
  }

  private record(
    context: ExecutionContext,
    req: { method: string; route?: { path: string }; url: string },
    start: bigint,
  ): void {
    const res = context.switchToHttp().getResponse<{ statusCode: number }>();
    // route.path e a "rota" (com placeholders), nao a URL — evita cardinalidade explosiva.
    const route = req.route?.path ?? 'unknown';
    const labels = {
      method: req.method,
      route,
      status_code: String(res.statusCode),
    };
    this.metrics.httpRequestsTotal.inc(labels);
    const durationSeconds = Number(process.hrtime.bigint() - start) / 1e9;
    this.metrics.httpRequestDurationSeconds.observe(labels, durationSeconds);
  }
}
