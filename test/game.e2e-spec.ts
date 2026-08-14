import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Fluxo completo autenticado: registro → login → partida rápida → verificação
 * do ranking. Cobre o caminho critico de coleta de dados que sustenta a
 * pesquisa do TCC.
 *
 * Requer infra no ar + migrations + seed executados. Ao final, o proprio
 * fluxo exclui o usuario de teste via self-delete (cascata limpa o resto).
 */
describe('Fluxo de jogo autenticado (e2e)', () => {
  let app: INestApplication;
  let server: ReturnType<INestApplication['getHttpServer']>;
  let token: string;
  let userId: number;
  const email = `e2e-${Date.now()}@test.local`;
  const password = 'testPassword123';
  // ID do "Ensino Medio" — 3o item da seed de education_level.
  const educationLevelId = 3;

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
    server = app.getHttpServer();
  });

  afterAll(async () => {
    // Cleanup: self-delete (cascata apaga game, ranking, sugestoes etc.).
    if (token) {
      await request(server)
        .delete('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ password })
        .catch(() => undefined);
    }
    await app.close();
  });

  it('registra um novo usuario e retorna JWT', async () => {
    const res = await request(server)
      .post('/api/v1/auth/register')
      .send({
        name: 'Teste E2E',
        email,
        password,
        educationLevelId,
        consentVersion: '2026-01-v1',
      })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(email);
    expect(res.body.user.role).toBe('user');
    token = res.body.accessToken;
    userId = res.body.user.id;
  });

  it('faz login com as credenciais criadas', async () => {
    const res = await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.id).toBe(userId);
  });

  it('rejeita login com senha errada', async () => {
    await request(server)
      .post('/api/v1/auth/login')
      .send({ email, password: 'senhaErrada' })
      .expect(401);
  });

  it('completa um ciclo Rapido: start → next → answer × N → finish', async () => {
    // 1. Inicia partida no modo Rapido (5 perguntas)
    const start = await request(server)
      .post('/api/v1/games')
      .set('Authorization', `Bearer ${token}`)
      .send({ difficultyId: 'quick', educationLevelId })
      .expect(201);

    const { gameId } = start.body;
    expect(gameId).toBeDefined();
    expect(start.body.totalQuestions).toBe(5);

    // 2. Loop de perguntas até o servidor sinalizar `finished`
    let answered = 0;
    for (let i = 0; i < 10 && answered < 5; i++) {
      const next = await request(server)
        .get(`/api/v1/games/${gameId}/next`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      if (next.body.finished || !next.body.question) break;

      const optionId = next.body.question.options[0].id;
      const answer = await request(server)
        .post(`/api/v1/games/${gameId}/answers`)
        .set('Authorization', `Bearer ${token}`)
        .send({ optionId })
        .expect(201);

      expect(answer.body).toHaveProperty('isCorrect');
      expect(answer.body).toHaveProperty('correctOptionId');
      expect(answer.body).toHaveProperty('earnedPoints');
      answered += 1;
    }

    expect(answered).toBeGreaterThan(0);

    // 3. Finaliza a partida
    const finish = await request(server)
      .post(`/api/v1/games/${gameId}/finish`)
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(finish.body.gameId).toBe(gameId);
    expect(finish.body.totalAnswered).toBe(answered);
    expect(finish.body.totalCorrect).toBeGreaterThanOrEqual(0);
  });

  it('a partida finalizada aparece no ranking geral', async () => {
    const res = await request(server).get('/api/v1/ranking?limit=100').expect(200);
    const entry = res.body.find((r: { user?: { id: number } }) => r.user?.id === userId);
    expect(entry).toBeDefined();
    expect(entry.score).toBeGreaterThanOrEqual(0);
  });

  it('exporta os dados do usuario (portabilidade LGPD)', async () => {
    const res = await request(server)
      .get('/api/v1/users/me/export')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.profile.email).toBe(email);
    expect(res.body.profile.id).toBe(userId);
    expect(Array.isArray(res.body.games)).toBe(true);
    expect(res.body.games.length).toBeGreaterThan(0);
    expect(res.body.games[0].answers.length).toBeGreaterThan(0);
    expect(Array.isArray(res.body.consents)).toBe(true);
    expect(res.body.consents.length).toBeGreaterThan(0);
  });
});
