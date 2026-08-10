/**
 * Regras de pontuacao do jogo (gamificacao: pontos + streak).
 * Funcao pura e isolada para ser facilmente testavel e ajustavel sem tocar no
 * fluxo do motor de jogo.
 */

export const BASE_POINTS = 100;
/** Bonus por acerto usando power-up e reduzido: distingue "saber" de "ser ajudado". */
export const POWERUP_PENALTY = 0.5;
/** Janela (ms) em que a resposta ainda ganha bonus de velocidade. */
export const SPEED_WINDOW_MS = 15000;
export const MAX_SPEED_BONUS = 50;
export const STREAK_BONUS = 25;

export interface ScoreInput {
  isCorrect: boolean;
  difficulty: number;
  responseTimeMs: number;
  currentStreak: number;
  usedPowerup: boolean;
}

export interface ScoreResult {
  points: number;
  newStreak: number;
}

/**
 * Pontos = (base x dificuldade + bonus de velocidade + bonus de streak) com
 * eventual penalidade por uso de ajuda. Erro zera a streak e nao pontua.
 */
export function computeScore(input: ScoreInput): ScoreResult {
  if (!input.isCorrect) {
    return { points: 0, newStreak: 0 };
  }

  const difficultyFactor = Math.max(1, input.difficulty);
  const base = BASE_POINTS * difficultyFactor;

  const clampedTime = Math.min(Math.max(input.responseTimeMs, 0), SPEED_WINDOW_MS);
  const speedBonus = Math.round(MAX_SPEED_BONUS * (1 - clampedTime / SPEED_WINDOW_MS));

  const newStreak = input.currentStreak + 1;
  const streakBonus = (newStreak - 1) * STREAK_BONUS;

  let points = base + speedBonus + streakBonus;
  if (input.usedPowerup) {
    points = Math.round(points * POWERUP_PENALTY);
  }

  return { points, newStreak };
}
