import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const config = app.get(ConfigService);
  const appConfig = config.get<AppConfig>('app')!;

  // Prefixo global (ex.: /api/v1). O /health fica fora para o healthcheck.
  app.setGlobalPrefix(appConfig.apiPrefix, { exclude: ['health'] });

  // CORS liberado apenas para as origens configuradas.
  app.enableCors({
    origin: appConfig.corsOrigins.includes('*') ? true : appConfig.corsOrigins,
    credentials: true,
  });

  // Validacao/transformacao automatica de DTOs em toda a aplicacao.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // remove propriedades nao declaradas no DTO
      forbidNonWhitelisted: true, // rejeita payloads com campos extras
      transform: true, // converte tipos primitivos conforme o DTO
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Documentacao OpenAPI (Swagger) exposta em /{prefix}/docs.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Desafio ODS - API')
    .setDescription(
      'API da plataforma gamificada para levantamento do conhecimento sobre os ' +
        'Objetivos de Desenvolvimento Sustentavel (ODS). Inclui autenticacao JWT, ' +
        'catalogo de perguntas por ODS, motor de jogo (REST + WebSocket) e camada analitica.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .addTag('auth', 'Autenticacao e consentimento (LGPD)')
    .addTag('users', 'Usuarios e perfis')
    .addTag('geo', 'Hierarquia geografica (pais, estado, cidade, escola)')
    .addTag('goals', 'Objetivos de Desenvolvimento Sustentavel (ODS)')
    .addTag('questions', 'Perguntas e opcoes')
    .addTag('games', 'Motor do jogo (partidas, respostas e power-ups)')
    .addTag('ranking', 'Ranking de pontuacao')
    .addTag('analytics', 'Camada analitica (materialized views)')
    .addTag('health', 'Verificacao de saude do servico')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup(`${appConfig.apiPrefix}/docs`, app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(appConfig.port);

  // eslint-disable-next-line no-console
  console.log(
    `API no ar em http://localhost:${appConfig.port}/${appConfig.apiPrefix} ` +
      `(docs: /${appConfig.apiPrefix}/docs)`,
  );
}

void bootstrap();
