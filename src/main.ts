import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { AppConfig } from './config/configuration';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  // Um unico salto de proxy na frente (Cloudflare). Sem isto, `req.ip` e o
  // endereco do soquete — o IP de borda da Cloudflare — e nao o do usuario, o
  // que polui os logs e engana qualquer decisao tomada por IP.
  //
  // O valor 1 significa "confie no ultimo salto". Nao usar `true`: isso mandaria
  // o Express aceitar a ponta esquerda de X-Forwarded-For, que e escrita pelo
  // cliente e portanto forjavel.
  app.set('trust proxy', 1);

  // Substitui o logger padrao pelo Pino (JSON estruturado; pretty apenas em dev).
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService);
  const appConfig = config.get<AppConfig>('app')!;

  // Headers seguros por padrao (X-Content-Type-Options, X-Frame-Options, HSTS etc.).
  // CSP fica desligada pois a API nao serve HTML — Swagger UI serve seus proprios assets.
  app.use(helmet({ contentSecurityPolicy: false }));

  // Prefixo global (ex.: /api/v1). O /health fica fora para o healthcheck.
  app.setGlobalPrefix(appConfig.apiPrefix, { exclude: ['health', 'metrics'] });

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
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
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
