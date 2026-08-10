import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { RedisModule } from './common/redis/redis.module';
import configuration, { DatabaseConfig } from './config/configuration';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { GameModule } from './modules/game/game.module';
import { GeoModule } from './modules/geo/geo.module';
import { GoalsModule } from './modules/goals/goals.module';
import { HealthModule } from './modules/health/health.module';
import { PowerupsModule } from './modules/powerups/powerups.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { RankingModule } from './modules/ranking/ranking.module';
import { SchoolsModule } from './modules/schools/schools.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    // Configuracao global tipada a partir de variaveis de ambiente.
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
    }),

    // Conexao com o PostgreSQL. Entidades carregadas por autoLoad dos modulos.
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.get<DatabaseConfig>('database')!;
        return {
          type: 'postgres',
          host: db.host,
          port: db.port,
          username: db.username,
          password: db.password,
          database: db.database,
          autoLoadEntities: true,
          synchronize: db.synchronize, // false em producao; migrations mandam.
          logging: db.logging,
          namingStrategy: new SnakeNamingStrategy(),
        };
      },
    }),

    RedisModule,

    // Modulos de dominio.
    AuthModule,
    UsersModule,
    GeoModule,
    SchoolsModule,
    GoalsModule,
    QuestionsModule,
    PowerupsModule,
    GameModule,
    RankingModule,
    AnalyticsModule,
    DashboardModule,
    HealthModule,
  ],
})
export class AppModule {}
