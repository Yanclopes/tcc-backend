import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { PowerupsService } from '../powerups/powerups.service';
import { QuestionsService } from '../questions/questions.service';
import { GamePowerup } from '../powerups/entities/game-powerup.entity';
import { Ranking } from '../ranking/entities/ranking.entity';
import { GameAnswer } from './entities/game-answer.entity';
import { GameDifficulty } from './entities/game-difficulty.entity';
import { GameStatus } from './entities/game-status.entity';
import { Game } from './entities/game.entity';
import { GameService } from './game.service';
import { GameSessionService } from './game-session.service';
import { GameSessionState } from './game-session.types';

/** Cria um estado de sessao base com uma pergunta em aberto. */
function baseState(overrides: Partial<GameSessionState> = {}): GameSessionState {
  return {
    gameId: 'game-1',
    userId: null,
    difficultyId: 'classic',
    educationLevelId: null,
    numberQuestions: 15,
    endsOnWrong: false,
    score: 0,
    streak: 0,
    answered: 0,
    servedQuestionIds: [10],
    currentQuestion: {
      questionId: 10,
      difficulty: 2,
      startedAt: Date.now() - 3000,
      removedOptionIds: [],
      powerupUsed: null,
    },
    powerups: { fifty: true, skip: true, audience: true },
    status: 'in_progress',
    ...overrides,
  };
}

describe('GameService', () => {
  let service: GameService;
  // Mocks tipados como jest.Mock para evitar rigidez de assinatura nos testes.
  let session: { getOrFail: jest.Mock; save: jest.Mock; remove: jest.Mock };
  let questions: {
    gradeAnswer: jest.Mock;
    getWrongOptionIds: jest.Mock;
    findOne: jest.Mock;
  };

  const mockRepo = () => ({
    create: jest.fn((v) => v),
    save: jest.fn((v) => Promise.resolve(v)),
    update: jest.fn(() => Promise.resolve({ affected: 1 })),
    count: jest.fn(() => Promise.resolve(0)),
    findOne: jest.fn(() => Promise.resolve(null)),
  });

  beforeEach(async () => {
    session = {
      getOrFail: jest.fn(),
      save: jest.fn(() => Promise.resolve()),
      remove: jest.fn(() => Promise.resolve()),
    };
    questions = {
      gradeAnswer: jest.fn(),
      getWrongOptionIds: jest.fn(),
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        { provide: getRepositoryToken(Game), useFactory: mockRepo },
        { provide: getRepositoryToken(GameStatus), useFactory: mockRepo },
        { provide: getRepositoryToken(GameDifficulty), useFactory: mockRepo },
        { provide: getRepositoryToken(GameAnswer), useFactory: mockRepo },
        { provide: getRepositoryToken(GamePowerup), useFactory: mockRepo },
        { provide: getRepositoryToken(Ranking), useFactory: mockRepo },
        { provide: QuestionsService, useValue: questions },
        {
          provide: PowerupsService,
          useValue: { findAll: jest.fn(), findByName: jest.fn(() => Promise.resolve(null)) },
        },
        { provide: GameSessionService, useValue: session },
      ],
    }).compile();

    service = module.get(GameService);
  });

  describe('submitAnswer', () => {
    it('lanca erro quando nao ha pergunta em aberto', async () => {
      session.getOrFail.mockResolvedValue(baseState({ currentQuestion: null }));
      await expect(service.submitAnswer('game-1', 1)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('pontua e incrementa a streak ao acertar', async () => {
      const state = baseState();
      session.getOrFail.mockResolvedValue(state);
      questions.gradeAnswer.mockResolvedValue({ isCorrect: true, correctOptionId: 99 });

      const result = await service.submitAnswer('game-1', 99, 15000);

      expect(result.isCorrect).toBe(true);
      expect(result.correctOptionId).toBe(99);
      expect(result.earnedPoints).toBeGreaterThan(0);
      expect(result.state.streak).toBe(1);
      expect(result.state.answered).toBe(1);
      expect(session.save).toHaveBeenCalled();
    });

    it('zera a streak ao errar', async () => {
      const state = baseState({ streak: 3 });
      session.getOrFail.mockResolvedValue(state);
      questions.gradeAnswer.mockResolvedValue({ isCorrect: false, correctOptionId: 99 });

      const result = await service.submitAnswer('game-1', 1, 1000);

      expect(result.isCorrect).toBe(false);
      expect(result.earnedPoints).toBe(0);
      expect(result.state.streak).toBe(0);
    });

    it('nao encerra a partida ao errar nos modos normais', async () => {
      const state = baseState({ endsOnWrong: false });
      session.getOrFail.mockResolvedValue(state);
      questions.gradeAnswer.mockResolvedValue({ isCorrect: false, correctOptionId: 99 });

      const result = await service.submitAnswer('game-1', 1, 1000);

      expect(result.finished).toBe(false);
      expect(result.eliminated).toBe(false);
    });

    it('encerra imediatamente ao errar no modo Sobrevivencia', async () => {
      const state = baseState({ endsOnWrong: true, numberQuestions: null });
      session.getOrFail.mockResolvedValue(state);
      questions.gradeAnswer.mockResolvedValue({ isCorrect: false, correctOptionId: 99 });

      const result = await service.submitAnswer('game-1', 1, 1000);

      expect(result.eliminated).toBe(true);
      expect(result.finished).toBe(true);
      expect(result.state.status).toBe('finished');
    });

    it('continua no modo Sobrevivencia enquanto acerta', async () => {
      const state = baseState({ endsOnWrong: true, numberQuestions: null });
      session.getOrFail.mockResolvedValue(state);
      questions.gradeAnswer.mockResolvedValue({ isCorrect: true, correctOptionId: 99 });

      const result = await service.submitAnswer('game-1', 99, 2000);

      expect(result.eliminated).toBe(false);
      expect(result.finished).toBe(false);
    });
  });

  describe('usePowerup', () => {
    it('fifty devolve 2 opcoes removidas e consome o saldo', async () => {
      const state = baseState();
      session.getOrFail.mockResolvedValue(state);
      questions.getWrongOptionIds.mockResolvedValue([11, 14]);

      const result = await service.usePowerup('game-1', 'fifty');

      expect(result.removedOptionIds).toEqual([11, 14]);
      expect(result.state.powerups.fifty).toBe(false);
    });

    it('rejeita power-up indisponivel', async () => {
      session.getOrFail.mockResolvedValue(baseState({ powerups: { fifty: false } }));
      await expect(service.usePowerup('game-1', 'fifty')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });
});
