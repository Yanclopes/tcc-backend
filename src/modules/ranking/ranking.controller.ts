import { Controller, DefaultValuePipe, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Ranking } from './entities/ranking.entity';
import { RankingService } from './ranking.service';

@ApiTags('ranking')
@Controller('ranking')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get()
  @ApiOperation({ summary: 'Placar geral (top N pontuacoes)' })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  top(@Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number): Promise<Ranking[]> {
    return this.rankingService.findTop(limit);
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Historico de pontuacoes de um usuario' })
  byUser(@Param('userId', ParseIntPipe) userId: number): Promise<Ranking[]> {
    return this.rankingService.findByUser(userId);
  }
}
