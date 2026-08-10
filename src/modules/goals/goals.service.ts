import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal } from './entities/goal.entity';

@Injectable()
export class GoalsService {
  constructor(
    @InjectRepository(Goal)
    private readonly goalRepository: Repository<Goal>,
  ) {}

  findAll(): Promise<Goal[]> {
    return this.goalRepository.find({ order: { number: 'ASC' } });
  }

  async findByNumber(number: number): Promise<Goal> {
    const goal = await this.goalRepository.findOne({ where: { number } });
    if (!goal) {
      throw new NotFoundException(`ODS numero ${number} nao encontrado.`);
    }
    return goal;
  }
}
