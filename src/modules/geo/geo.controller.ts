import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { OptionalParseIntPipe } from '../../common/pipes/optional-parse-int.pipe';
import { City } from './entities/city.entity';
import { Country } from './entities/country.entity';
import { School } from './entities/school.entity';
import { State } from './entities/state.entity';
import { GeoService } from './geo.service';

@ApiTags('geo')
@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Get('countries')
  @ApiOperation({ summary: 'Lista paises' })
  countries(): Promise<Country[]> {
    return this.geoService.findCountries();
  }

  @Get('states')
  @ApiOperation({ summary: 'Lista estados (filtra por countryId opcional)' })
  @ApiQuery({ name: 'countryId', required: false, type: Number })
  states(
    @Query('countryId', OptionalParseIntPipe) countryId?: number,
  ): Promise<State[]> {
    return this.geoService.findStates(countryId);
  }

  @Get('cities')
  @ApiOperation({ summary: 'Lista cidades (filtra por stateId opcional)' })
  @ApiQuery({ name: 'stateId', required: false, type: Number })
  cities(
    @Query('stateId', OptionalParseIntPipe) stateId?: number,
  ): Promise<City[]> {
    return this.geoService.findCities(stateId);
  }

  @Get('schools')
  @ApiOperation({ summary: 'Lista escolas (filtra por cityId opcional)' })
  @ApiQuery({ name: 'cityId', required: false, type: Number })
  schools(
    @Query('cityId', OptionalParseIntPipe) cityId?: number,
  ): Promise<School[]> {
    return this.geoService.findSchools(cityId);
  }
}
