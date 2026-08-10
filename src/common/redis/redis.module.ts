import { Global, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModuleRef } from '@nestjs/core';
import Redis from 'ioredis';
import { RedisConfig } from '../../config/configuration';
import { REDIS_CLIENT } from './redis.constants';
import { RedisService } from './redis.service';

/**
 * Modulo global do Redis: expoe um unico cliente ioredis compartilhado por toda
 * a aplicacao (estado de jogo em tempo real). Global evita reimportar em cada
 * modulo que precise de cache/estado efemero.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): Redis => {
        const redisConfig = config.get<RedisConfig>('redis')!;
        return new Redis({
          host: redisConfig.host,
          port: redisConfig.port,
          password: redisConfig.password,
          db: redisConfig.db,
          maxRetriesPerRequest: null,
          lazyConnect: false,
        });
      },
    },
    RedisService,
  ],
  exports: [REDIS_CLIENT, RedisService],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(private readonly moduleRef: ModuleRef) {}

  // Fecha a conexao de forma limpa quando a aplicacao encerra.
  async onApplicationShutdown(): Promise<void> {
    const client = this.moduleRef.get<Redis>(REDIS_CLIENT, { strict: false });
    await client?.quit();
  }
}
