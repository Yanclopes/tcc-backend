import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { PowerupsModule } from '../powerups/powerups.module';
import { GamePowerup } from '../powerups/entities/game-powerup.entity';
import { QuestionsModule } from '../questions/questions.module';
import { Ranking } from '../ranking/entities/ranking.entity';
import { GameAnswer } from './entities/game-answer.entity';
import { GameDifficulty } from './entities/game-difficulty.entity';
import { GameStatus } from './entities/game-status.entity';
import { Game } from './entities/game.entity';
import { GameController } from './game.controller';
import { GameGateway } from './game.gateway';
import { GameService } from './game.service';
import { GameSessionService } from './game-session.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Game, GameStatus, GameDifficulty, GameAnswer, GamePowerup, Ranking]),
    QuestionsModule,
    PowerupsModule,
    AuthModule,
  ],
  controllers: [GameController],
  providers: [GameService, GameSessionService, GameGateway],
  exports: [GameService],
})
export class GameModule {}
