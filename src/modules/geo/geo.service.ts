import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { City } from './entities/city.entity';
import { Country } from './entities/country.entity';
import { School } from './entities/school.entity';
import { State } from './entities/state.entity';

/**
 * Consultas da hierarquia geografica. Servem ao cadastro (dropdowns encadeados)
 * e ao recorte geografico do levantamento de dados.
 */
@Injectable()
export class GeoService {
  constructor(
    @InjectRepository(Country) private readonly countryRepo: Repository<Country>,
    @InjectRepository(State) private readonly stateRepo: Repository<State>,
    @InjectRepository(City) private readonly cityRepo: Repository<City>,
    @InjectRepository(School) private readonly schoolRepo: Repository<School>,
  ) {}

  findCountries(): Promise<Country[]> {
    return this.countryRepo.find({ order: { name: 'ASC' } });
  }

  findStates(countryId?: number): Promise<State[]> {
    return this.stateRepo.find({
      where: countryId ? { country: { id: countryId } } : {},
      order: { name: 'ASC' },
    });
  }

  findCities(stateId?: number): Promise<City[]> {
    return this.cityRepo.find({
      where: stateId ? { state: { id: stateId } } : {},
      order: { name: 'ASC' },
    });
  }

  findSchools(cityId?: number): Promise<School[]> {
    return this.schoolRepo.find({
      where: cityId ? { city: { id: cityId } } : {},
      order: { name: 'ASC' },
    });
  }
}
