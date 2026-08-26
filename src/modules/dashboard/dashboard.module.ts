import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameAnswer } from '../game/entities/game-answer.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([GameAnswer])],
  controllers: [DashboardController],
  providers: [DashboardService],
  // Exportado para o modulo de chat, que reaproveita os agregados como
  // ferramentas do assistente (ver .specs/06-chat-ia.md).
  exports: [DashboardService],
})
export class DashboardModule {}
