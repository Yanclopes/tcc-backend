import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Testes de saude e catalogo publico. Requer infra no ar e schema migrado:
 *   docker compose up -d postgres redis
 *   npm run migration:run:prod
 *   npm run seed:prod
 *   npm run test:e2e
 *
 * O throttler global e desativado nos testes para nao interferir na cadencia
 * das requisicoes. O fluxo autenticado de partida vive em game.e2e-spec.ts.
 */
describe('API — saude e catalogo (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/health responde ok e reporta Postgres + Redis up', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.info.database.status).toBe('up');
    expect(res.body.info.redis.status).toBe('up');
  });

  it('GET /api/v1/goals retorna os 17 ODS', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/goals').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(17);
  });

  it('POST /api/v1/games sem token e rejeitado (auth obrigatoria)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/games')
      .send({ difficultyId: 'quick' })
      .expect(401);
  });
});
