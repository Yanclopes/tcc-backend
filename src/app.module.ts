import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoggerModule } from 'nestjs-pino';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { RedisModule } from './common/redis/redis.module';
import { MetricsModule } from './common/metrics/metrics.module';
import configuration, { DatabaseConfig } from './config/configuration';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
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

    // Logs estruturados JSON (Pino). Em dev, formata legivel; em prod, JSON puro
    // pronto para agregacao (CloudWatch/Loki/etc.). Correlaciona por req.id.
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        autoLogging: {
          ignore: (req) => {
            const url = (req as { url?: string }).url ?? '';
            return url === '/health' || url === '/metrics';
          },
        },
        transport:
          process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
              }
            : undefined,
        redact: {
          paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
          censor: '[REDACTED]',
        },
      },
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
    MetricsModule,

    // Rate limiting global — bucket unico e generoso (120 req/min por IP).
    // Endpoints sensiveis (auth) diminuem o limite com @Throttle override.
    // Nao definir buckets extras nomeados: em @nestjs/throttler v6, TODOS os
    // buckets sao aplicados por padrao — dois buckets = dois limites por request.
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),

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
    ChatModule,
    HealthModule,
  ],
  providers: [
    // Aplica o rate limit em toda a aplicacao; endpoints usam @Throttle para override.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
