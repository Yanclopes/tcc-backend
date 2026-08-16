import { Controller, Get, Header, Res, UseGuards } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { MetricsGuard } from './metrics.guard';
import { MetricsService } from './metrics.service';

/**
 * Endpoint scrape do Prometheus. Fora do prefixo /api. Protegido por Basic Auth
 * (MetricsGuard) para nao expor rotas, latencia e uso de recursos publicamente.
 */
@ApiExcludeController()
@Controller('metrics')
@UseGuards(MetricsGuard)
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async scrape(@Res() res: Response): Promise<void> {
    res.setHeader('Content-Type', this.metrics.contentType());
    res.send(await this.metrics.render());
  }
}
