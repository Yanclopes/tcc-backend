import { config as loadEnv } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

// Carrega o .env quando a CLI do TypeORM roda fora do contexto do Nest.
loadEnv();

/**
 * Opcoes compartilhadas entre a aplicacao Nest (TypeOrmModule) e a CLI do
 * TypeORM (geracao/execucao de migrations). Mantê-las em um unico lugar evita
 * divergencias entre o que roda em runtime e o que roda nas migrations.
 */
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number.parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'ods',
  password: process.env.DB_PASSWORD ?? 'ods_secret',
  database: process.env.DB_DATABASE ?? 'ods_quiz',
  // Entidades e migrations sao carregadas por glob para funcionar tanto em
  // .ts (ts-node) quanto em .js (build compilado em dist).
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/../database/migrations/*{.ts,.js}'],
  // Mapeia propriedades camelCase -> colunas snake_case automaticamente.
  namingStrategy: new SnakeNamingStrategy(),
  // synchronize SEMPRE falso: o schema e versionado por migrations.
  synchronize: false,
  logging: ['1', 'true', 'yes', 'on'].includes((process.env.DB_LOGGING ?? '').toLowerCase()),
};

// Instancia usada exclusivamente pela CLI (npm run migration:*).
const dataSource = new DataSource(dataSourceOptions);
export default dataSource;
