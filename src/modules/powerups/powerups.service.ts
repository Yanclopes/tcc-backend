import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Powerup } from './entities/powerup.entity';

@Injectable()
export class PowerupsService {
  constructor(
    @InjectRepository(Powerup)
    private readonly powerupRepository: Repository<Powerup>,
  ) {}

  findAll(): Promise<Powerup[]> {
    return this.powerupRepository.find({ order: { id: 'ASC' } });
  }

  findByName(name: string): Promise<Powerup | null> {
    return this.powerupRepository.findOne({ where: { name } });
  }
}
