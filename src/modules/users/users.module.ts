import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditModule } from '../audit/audit.module';
import { GameAnswer } from '../game/entities/game-answer.entity';
import { Game } from '../game/entities/game.entity';
import { Ranking } from '../ranking/entities/ranking.entity';
import { SchoolSuggestion } from '../schools/entities/school-suggestion.entity';
import { EducationLevel } from './entities/education-level.entity';
import { AppUser } from './entities/app-user.entity';
import { Role } from './entities/role.entity';
import { UserConsent } from './entities/user-consent.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    // Entidades do proprio dominio + as usadas pela exportacao LGPD e self-delete.
    TypeOrmModule.forFeature([
      AppUser,
      Role,
      EducationLevel,
      UserConsent,
      Game,
      GameAnswer,
      Ranking,
      SchoolSuggestion,
    ]),
    AuditModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
