import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Goal } from './entities/goal.entity';
import { GoalsService } from './goals.service';

@ApiTags('goals')
@Controller('goals')
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Get()
  @ApiOperation({ summary: 'Lista os 17 ODS (ordenados por numero)' })
  findAll(): Promise<Goal[]> {
    return this.goalsService.findAll();
  }

  @Get(':number')
  @ApiOperation({ summary: 'Retorna um ODS pelo seu numero canonico (1-17)' })
  findByNumber(@Param('number', ParseIntPipe) number: number): Promise<Goal> {
    return this.goalsService.findByNumber(number);
  }
}
