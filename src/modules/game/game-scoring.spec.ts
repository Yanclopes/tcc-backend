import { BASE_POINTS, computeScore, POWERUP_PENALTY, STREAK_BONUS } from './game-scoring';

describe('computeScore', () => {
  it('nao pontua e zera a streak quando erra', () => {
    const result = computeScore({
      isCorrect: false,
      difficulty: 5,
      responseTimeMs: 100,
      currentStreak: 4,
      usedPowerup: false,
    });
    expect(result).toEqual({ points: 0, newStreak: 0 });
  });

  it('aplica base proporcional a dificuldade', () => {
    const result = computeScore({
      isCorrect: true,
      difficulty: 3,
      responseTimeMs: 15000, // sem bonus de velocidade
      currentStreak: 0,
      usedPowerup: false,
    });
    // base (100*3) + speed(0) + streak(0)
    expect(result.points).toBe(BASE_POINTS * 3);
    expect(result.newStreak).toBe(1);
  });

  it('concede bonus maximo de velocidade para resposta instantanea', () => {
    const result = computeScore({
      isCorrect: true,
      difficulty: 1,
      responseTimeMs: 0,
      currentStreak: 0,
      usedPowerup: false,
    });
    // base(100) + speed(50) + streak(0)
    expect(result.points).toBe(150);
  });

  it('acumula bonus de streak', () => {
    const result = computeScore({
      isCorrect: true,
      difficulty: 1,
      responseTimeMs: 15000,
      currentStreak: 3,
      usedPowerup: false,
    });
    // base(100) + speed(0) + streak((4-1)*25)
    expect(result.newStreak).toBe(4);
    expect(result.points).toBe(BASE_POINTS + 3 * STREAK_BONUS);
  });

  it('penaliza pontos quando usa power-up', () => {
    const semAjuda = computeScore({
      isCorrect: true,
      difficulty: 2,
      responseTimeMs: 15000,
      currentStreak: 0,
      usedPowerup: false,
    });
    const comAjuda = computeScore({
      isCorrect: true,
      difficulty: 2,
      responseTimeMs: 15000,
      currentStreak: 0,
      usedPowerup: true,
    });
    expect(comAjuda.points).toBe(Math.round(semAjuda.points * POWERUP_PENALTY));
  });
});
