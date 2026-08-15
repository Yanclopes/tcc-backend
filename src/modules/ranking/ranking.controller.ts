import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Ranking } from './entities/ranking.entity';
import { RankingService, RANKING_MODES, RankingMode } from './ranking.service';

@ApiTags('ranking')
@Controller('ranking')
export class RankingController {
  constructor(private readonly rankingService: RankingService) {}

  @Get()
  @ApiOperation({
    summary: 'Placar (top N por melhor partida de cada usuario)',
    description:
      'Retorna uma linha por usuario com a melhor pontuacao dele. Se `mode` for informado, ' +
      'filtra pelo modo de jogo. Sem `mode`, considera partidas de todos os modos.',
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiQuery({ name: 'mode', required: false, enum: RANKING_MODES })
  top(
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('mode') mode?: string,
  ): Promise<Ranking[]> {
    let validated: RankingMode | undefined;
    if (mode) {
      if (!RANKING_MODES.includes(mode as RankingMode)) {
        throw new BadRequestException(`Modo invalido. Use um de: ${RANKING_MODES.join(', ')}.`);
      }
      validated = mode as RankingMode;
    }
    return this.rankingService.findTop(limit, validated);
  }

  @Get('users/:userId')
  @ApiOperation({ summary: 'Historico de pontuacoes de um usuario (todas as partidas)' })
  byUser(@Param('userId', ParseIntPipe) userId: number): Promise<Ranking[]> {
    return this.rankingService.findByUser(userId);
  }
}
