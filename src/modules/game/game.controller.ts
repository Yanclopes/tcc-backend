import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser, JwtUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  AnswerResultDto,
  FinishGameResponseDto,
  GameStateDto,
  NextQuestionResponseDto,
  PowerupResultDto,
  StartGameResponseDto,
} from './dto/game-responses.dto';
import { StartGameDto } from './dto/start-game.dto';
import { SubmitAnswerDto } from './dto/submit-answer.dto';
import { UsePowerupDto } from './dto/use-powerup.dto';
import { GameService } from './game.service';

@ApiTags('games')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard)
@Controller('games')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Post()
  @ApiOperation({ summary: 'Inicia uma partida vinculada ao usuario autenticado' })
  start(@Body() dto: StartGameDto, @CurrentUser() user: JwtUser): Promise<StartGameResponseDto> {
    return this.gameService.startGame(dto.difficultyId, user.userId, dto.educationLevelId);
  }

  @Get(':id/state')
  @ApiOperation({ summary: 'Retorna o estado atual da partida' })
  getState(@Param('id') id: string): Promise<GameStateDto> {
    return this.gameService.getState(id);
  }

  @Get(':id/next')
  @ApiOperation({ summary: 'Solicita a proxima pergunta (sem revelar a resposta)' })
  next(@Param('id') id: string): Promise<NextQuestionResponseDto> {
    return this.gameService.getNextQuestion(id);
  }

  @Post(':id/answers')
  @ApiOperation({ summary: 'Envia a resposta da pergunta atual' })
  answer(@Param('id') id: string, @Body() dto: SubmitAnswerDto): Promise<AnswerResultDto> {
    return this.gameService.submitAnswer(id, dto.optionId, dto.responseTimeMs);
  }

  @Post(':id/powerups')
  @ApiOperation({ summary: 'Usa um power-up (fifty, skip, audience) na pergunta atual' })
  usePowerup(@Param('id') id: string, @Body() dto: UsePowerupDto): Promise<PowerupResultDto> {
    return this.gameService.usePowerup(id, dto.powerup);
  }

  @Post(':id/finish')
  @ApiOperation({ summary: 'Finaliza a partida e grava o ranking' })
  finish(@Param('id') id: string): Promise<FinishGameResponseDto> {
    return this.gameService.finishGame(id);
  }
}
