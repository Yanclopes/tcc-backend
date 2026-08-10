import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { City } from '../geo/entities/city.entity';
import { School } from '../geo/entities/school.entity';
import { AppUser } from '../users/entities/app-user.entity';
import { EducationLevel } from '../users/entities/education-level.entity';
import { SchoolSuggestion } from './entities/school-suggestion.entity';
import { SchoolsController } from './schools.controller';
import { SchoolsService } from './schools.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([School, City, EducationLevel, SchoolSuggestion, AppUser]),
  ],
  controllers: [SchoolsController],
  providers: [SchoolsService],
  exports: [SchoolsService],
})
export class SchoolsModule {}
