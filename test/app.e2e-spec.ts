import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Teste ponta-a-ponta. Requer a infraestrutura no ar e o schema migrado:
 *   docker compose up -d postgres redis
 *   npm run migration:run
 *   npm run seed
 *   npm run test:e2e
 *
 * Cobre o caminho critico: saude do servico, catalogo de ODS e o ciclo completo
 * de uma partida anonima (start -> next -> answer -> finish).
 */
describe('API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

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

  it('/health (GET) responde ok', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('/api/v1/goals (GET) retorna os 17 ODS', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/goals').expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(17);
  });

  it('ciclo de partida anonima: start -> next -> answer -> finish', async () => {
    const server = app.getHttpServer();

    const start = await request(server)
      .post('/api/v1/games')
      .send({ difficultyId: 'quick' })
      .expect(201);
    const gameId = start.body.gameId;
    expect(gameId).toBeDefined();

    const next = await request(server).get(`/api/v1/games/${gameId}/next`).expect(200);
    expect(next.body.question).toBeDefined();
    const optionId = next.body.question.options[0].id;

    const answer = await request(server)
      .post(`/api/v1/games/${gameId}/answers`)
      .send({ optionId })
      .expect(201);
    expect(answer.body).toHaveProperty('isCorrect');
    expect(answer.body).toHaveProperty('correctOptionId');

    const finish = await request(server)
      .post(`/api/v1/games/${gameId}/finish`)
      .expect(201);
    expect(finish.body.gameId).toBe(gameId);
  });
});
