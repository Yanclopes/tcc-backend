/**
 * Centraliza a leitura das variaveis de ambiente em um objeto tipado.
 * Carregado pelo @nestjs/config e consumido via ConfigService em toda a app.
 */
export interface AppConfig {
  env: string;
  port: number;
  apiPrefix: string;
  corsOrigins: string[];
}

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  database: string;
  synchronize: boolean;
  logging: boolean;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  gameSessionTtl: number;
}

export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

export interface GameConfig {
  defaultPowerups: number;
}

const toBool = (value: string | undefined, fallback = false): boolean => {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export default () => ({
  app: {
    env: process.env.NODE_ENV ?? 'development',
    port: toInt(process.env.PORT, 3000),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    corsOrigins: (process.env.CORS_ORIGINS ?? '*')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  } as AppConfig,
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: toInt(process.env.DB_PORT, 5432),
    username: process.env.DB_USERNAME ?? 'ods',
    password: process.env.DB_PASSWORD ?? 'ods_secret',
    database: process.env.DB_DATABASE ?? 'ods_quiz',
    synchronize: toBool(process.env.DB_SYNCHRONIZE, false),
    logging: toBool(process.env.DB_LOGGING, false),
  } as DatabaseConfig,
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: toInt(process.env.REDIS_PORT, 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: toInt(process.env.REDIS_DB, 0),
    gameSessionTtl: toInt(process.env.GAME_SESSION_TTL, 7200),
  } as RedisConfig,
  jwt: {
    secret: process.env.JWT_SECRET ?? 'troque-este-segredo',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '1d',
  } as JwtConfig,
  game: {
    defaultPowerups: toInt(process.env.GAME_DEFAULT_POWERUPS, 3),
  } as GameConfig,
});
