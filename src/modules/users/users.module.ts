import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EducationLevel } from './entities/education-level.entity';
import { AppUser } from './entities/app-user.entity';
import { Role } from './entities/role.entity';
import { UserConsent } from './entities/user-consent.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([AppUser, Role, EducationLevel, UserConsent])],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
