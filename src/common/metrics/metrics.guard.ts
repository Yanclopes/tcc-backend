import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/**
 * Basic Auth para o endpoint /metrics. Bloqueia scrape publico do Prometheus,
 * evitando enumeracao de rotas, padroes de trafego e metricas de processo.
 *
 * Se METRICS_USER ou METRICS_PASSWORD nao estiverem definidos, nega tudo por
 * seguranca — evita expor por engano em deploys mal configurados.
 */
@Injectable()
export class MetricsGuard implements CanActivate {
  private readonly logger = new Logger(MetricsGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    const expectedUser = process.env.METRICS_USER;
    const expectedPassword = process.env.METRICS_PASSWORD;

    if (!expectedUser || !expectedPassword) {
      this.logger.warn('METRICS_USER/PASSWORD nao configurados; /metrics negado.');
      // Sinaliza pro operator: precisa 401 pro scraper saber que nao pode passar.
      throw new UnauthorizedException('Metrics auth not configured.');
    }

    const header = req.headers.authorization ?? '';
    if (!header.startsWith('Basic ')) {
      throw new UnauthorizedException();
    }

    const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString('utf8');
    const idx = decoded.indexOf(':');
    if (idx === -1) throw new UnauthorizedException();
    const user = decoded.slice(0, idx);
    const pass = decoded.slice(idx + 1);

    // Comparacao timing-safe evita ataque de canal lateral por tempo.
    if (!safeEqual(user, expectedUser) || !safeEqual(pass, expectedPassword)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
