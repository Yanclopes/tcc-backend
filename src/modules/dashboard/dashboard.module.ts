import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GameAnswer } from '../game/entities/game-answer.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([GameAnswer])],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
