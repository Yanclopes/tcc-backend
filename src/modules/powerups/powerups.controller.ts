import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Powerup } from './entities/powerup.entity';
import { PowerupsService } from './powerups.service';

@ApiTags('games')
@Controller('powerups')
export class PowerupsController {
  constructor(private readonly powerupsService: PowerupsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os power-ups (ajudas) disponiveis' })
  findAll(): Promise<Powerup[]> {
    return this.powerupsService.findAll();
  }
}
