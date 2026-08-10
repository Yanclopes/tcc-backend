import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RedisConfig } from '../../config/configuration';
import { RedisService } from '../../common/redis/redis.service';
import { GameSessionState } from './game-session.types';

/**
 * Persistencia efemera do estado de jogo no Redis. Isola o resto da aplicacao
 * do formato das chaves e do TTL, oferecendo uma API orientada ao dominio.
 */
@Injectable()
export class GameSessionService {
  private readonly ttl: number;

  constructor(
    private readonly redis: RedisService,
    config: ConfigService,
  ) {
    this.ttl = config.get<RedisConfig>('redis')!.gameSessionTtl;
  }

  private key(gameId: string): string {
    return `game:${gameId}`;
  }

  async create(state: GameSessionState): Promise<void> {
    await this.redis.setJson(this.key(state.gameId), state, this.ttl);
  }

  async get(gameId: string): Promise<GameSessionState | null> {
    return this.redis.getJson<GameSessionState>(this.key(gameId));
  }

  /** Igual a get, mas lanca 404 quando a sessao expirou ou nao existe. */
  async getOrFail(gameId: string): Promise<GameSessionState> {
    const state = await this.get(gameId);
    if (!state) {
      throw new NotFoundException(
        `Sessao de jogo ${gameId} nao encontrada ou expirada.`,
      );
    }
    return state;
  }

  /** Regrava o estado renovando o TTL (mantem a sessao viva enquanto se joga). */
  async save(state: GameSessionState): Promise<void> {
    await this.redis.setJson(this.key(state.gameId), state, this.ttl);
  }

  async remove(gameId: string): Promise<void> {
    await this.redis.del(this.key(gameId));
  }
}
