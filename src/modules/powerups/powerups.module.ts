import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GamePowerup } from './entities/game-powerup.entity';
import { Powerup } from './entities/powerup.entity';
import { PowerupsController } from './powerups.controller';
import { PowerupsService } from './powerups.service';

@Module({
  imports: [TypeOrmModule.forFeature([Powerup, GamePowerup])],
  controllers: [PowerupsController],
  providers: [PowerupsService],
  exports: [PowerupsService],
})
export class PowerupsModule {}
