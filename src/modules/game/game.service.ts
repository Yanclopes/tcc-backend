import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PowerupsService } from '../powerups/powerups.service';
import { GamePowerup } from '../powerups/entities/game-powerup.entity';
import { Powerup } from '../powerups/entities/powerup.entity';
import { QuestionPublicDto } from '../questions/dto/question-public.dto';
import { QuestionsService } from '../questions/questions.service';
import { Ranking } from '../ranking/entities/ranking.entity';
import { AppUser } from '../users/entities/app-user.entity';
import { EducationLevel } from '../users/entities/education-level.entity';
import { SUPPORTED_POWERUPS } from './dto/use-powerup.dto';
import {
  AnswerResultDto,
  FinishGameResponseDto,
  GameStateDto,
  NextQuestionResponseDto,
  PowerupResultDto,
} from './dto/game-responses.dto';
import { GameAnswer } from './entities/game-answer.entity';
import { GameDifficulty } from './entities/game-difficulty.entity';
import { GameStatus } from './entities/game-status.entity';
import { Game } from './entities/game.entity';
import { GameSessionService } from './game-session.service';
import { GameSessionState } from './game-session.types';
import { computeScore } from './game-scoring';

const STATUS_IN_PROGRESS = 'in_progress';
const STATUS_FINISHED = 'finished';

@Injectable()
export class GameService {
  constructor(
    @InjectRepository(Game) private readonly gameRepo: Repository<Game>,
    @InjectRepository(GameStatus) private readonly statusRepo: Repository<GameStatus>,
    @InjectRepository(GameDifficulty)
    private readonly difficultyRepo: Repository<GameDifficulty>,
    @InjectRepository(GameAnswer) private readonly answerRepo: Repository<GameAnswer>,
    @InjectRepository(GamePowerup) private readonly gamePowerupRepo: Repository<GamePowerup>,
    @InjectRepository(Ranking) private readonly rankingRepo: Repository<Ranking>,
    private readonly questionsService: QuestionsService,
    private readonly powerupsService: PowerupsService,
    private readonly session: GameSessionService,
  ) {}

  // ------------------------------------------------------------------
  // Inicio da partida
  // ------------------------------------------------------------------
  async startGame(
    difficultyId: string,
    userId: number,
    educationLevelId?: number | null,
  ): Promise<GameStateDto> {
    const difficulty = await this.difficultyRepo.findOne({ where: { id: difficultyId } });
    if (!difficulty) {
      throw new NotFoundException(`Modo de dificuldade '${difficultyId}' nao encontrado.`);
    }

    const status = await this.getStatus(STATUS_IN_PROGRESS);
    const gameId = uuidv4();

    const game = this.gameRepo.create({
      id: gameId,
      user: { id: userId } as AppUser,
      status,
      difficulty,
      currentEducationLevel: educationLevelId ? ({ id: educationLevelId } as EducationLevel) : null,
      currentScore: 0,
      currentStreak: 0,
    });
    await this.gameRepo.save(game);

    // Concede o saldo de ajudas: uma de cada power-up existente no catalogo.
    const catalog = await this.powerupsService.findAll();
    const grantable = catalog.filter((p) => SUPPORTED_POWERUPS.includes(p.name as never));
    const powerups: Record<string, boolean> = {};
    for (const powerup of grantable) {
      await this.gamePowerupRepo.save(
        this.gamePowerupRepo.create({
          game: { id: gameId } as Game,
          powerup: { id: powerup.id } as Powerup,
          isUsed: false,
        }),
      );
      powerups[powerup.name] = true;
    }

    const state: GameSessionState = {
      gameId,
      userId,
      difficultyId,
      educationLevelId: educationLevelId ?? null,
      numberQuestions: difficulty.numberQuestions ?? null,
      endsOnWrong: difficulty.endsOnWrong ?? false,
      score: 0,
      streak: 0,
      answered: 0,
      servedQuestionIds: [],
      currentQuestion: null,
      powerups,
      status: STATUS_IN_PROGRESS,
    };
    await this.session.create(state);

    return this.toStateDto(state);
  }

  // ------------------------------------------------------------------
  // Proxima pergunta
  // ------------------------------------------------------------------
  async getNextQuestion(gameId: string): Promise<NextQuestionResponseDto> {
    const state = await this.session.getOrFail(gameId);

    if (this.reachedEnd(state)) {
      return { question: null, state: this.toStateDto(state), finished: true };
    }

    // Preferencia adaptativa por dificuldade; se nao houver pergunta desse nivel
    // ainda nao usada, faz fallback para qualquer nivel para nao encerrar cedo.
    let question = await this.questionsService.pickForGame({
      difficulty: this.difficultyForSequence(state),
      educationLevelId: state.educationLevelId ?? undefined,
      excludeIds: state.servedQuestionIds,
    });
    if (!question) {
      question = await this.questionsService.pickForGame({
        educationLevelId: state.educationLevelId ?? undefined,
        excludeIds: state.servedQuestionIds,
      });
    }

    if (!question) {
      // Repositorio de perguntas esgotado: encerra por falta de conteudo.
      return { question: null, state: this.toStateDto(state), finished: true };
    }

    state.currentQuestion = {
      questionId: question.id,
      difficulty: question.difficulty,
      startedAt: Date.now(),
      removedOptionIds: [],
      powerupUsed: null,
    };
    state.servedQuestionIds.push(question.id);
    await this.session.save(state);

    return {
      question: QuestionPublicDto.fromEntity(question),
      state: this.toStateDto(state),
      finished: false,
    };
  }

  // ------------------------------------------------------------------
  // Resposta
  // ------------------------------------------------------------------
  async submitAnswer(
    gameId: string,
    optionId: number,
    clientResponseTimeMs?: number,
  ): Promise<AnswerResultDto> {
    const state = await this.session.getOrFail(gameId);
    const current = state.currentQuestion;
    if (!current) {
      throw new BadRequestException('Nenhuma pergunta em aberto. Solicite a proxima pergunta.');
    }

    const responseTimeMs = this.resolveResponseTime(current.startedAt, clientResponseTimeMs);
    const { isCorrect, correctOptionId } = await this.questionsService.gradeAnswer(
      current.questionId,
      optionId,
    );

    const usedPowerup = current.powerupUsed !== null;
    const { points, newStreak } = computeScore({
      isCorrect,
      difficulty: current.difficulty,
      responseTimeMs,
      currentStreak: state.streak,
      usedPowerup,
    });

    state.score += points;
    state.streak = newStreak;
    state.answered += 1;

    await this.persistAnswer({
      gameId,
      questionId: current.questionId,
      optionId,
      isCorrect,
      responseTimeMs,
      sequence: state.answered,
      powerupName: current.powerupUsed,
    });
    await this.updateGameProgress(gameId, state.score, state.streak);

    state.currentQuestion = null;
    // No modo Sobrevivencia, errar encerra a partida na mesma resposta (sem
    // exigir uma proxima pergunta) — evita o "encerrar com atraso".
    const eliminated = state.endsOnWrong && !isCorrect;
    const finished = eliminated || this.reachedEnd(state);
    if (finished) state.status = STATUS_FINISHED;
    await this.session.save(state);

    return {
      isCorrect,
      correctOptionId,
      earnedPoints: points,
      state: this.toStateDto(state),
      finished,
      eliminated,
    };
  }

  // ------------------------------------------------------------------
  // Power-ups (ajudas)
  // ------------------------------------------------------------------
  async usePowerup(gameId: string, powerup: string): Promise<PowerupResultDto> {
    const state = await this.session.getOrFail(gameId);
    const current = state.currentQuestion;
    if (!current) {
      throw new BadRequestException('Nenhuma pergunta em aberto para usar a ajuda.');
    }
    if (!state.powerups[powerup]) {
      throw new BadRequestException(`Power-up '${powerup}' indisponivel nesta partida.`);
    }

    // Consome o saldo e marca a linha de game_powerup.
    state.powerups[powerup] = false;
    await this.markGamePowerupUsed(gameId, powerup);

    if (powerup === 'skip') {
      return this.applySkip(state);
    }

    // fifty e audience apenas modificam a pergunta atual; nao a encerram.
    current.powerupUsed = powerup;
    const result: PowerupResultDto = { powerup, state: this.toStateDto(state) };

    if (powerup === 'fifty') {
      const removed = await this.questionsService.getWrongOptionIds(current.questionId, 2);
      current.removedOptionIds = removed;
      result.removedOptionIds = removed;
    } else if (powerup === 'audience') {
      result.audienceDistribution = await this.simulateAudience(current.questionId);
    }

    await this.session.save(state);
    result.state = this.toStateDto(state);
    return result;
  }

  // ------------------------------------------------------------------
  // Fim da partida
  // ------------------------------------------------------------------
  async finishGame(gameId: string): Promise<FinishGameResponseDto> {
    const state = await this.session.getOrFail(gameId);

    const status = await this.getStatus(STATUS_FINISHED);
    await this.gameRepo.update(
      { id: gameId },
      { status, currentScore: state.score, finishedAt: new Date() },
    );

    const totalAnswered = await this.answerRepo.count({ where: { game: { id: gameId } } });
    const totalCorrect = await this.answerRepo.count({
      where: { game: { id: gameId }, isCorrect: true },
    });

    await this.rankingRepo.save(
      this.rankingRepo.create({
        user: { id: state.userId } as AppUser,
        game: { id: gameId } as Game,
        score: state.score,
        completedAt: new Date(),
      }),
    );

    await this.session.remove(gameId);

    return { gameId, finalScore: state.score, totalAnswered, totalCorrect };
  }

  async getState(gameId: string): Promise<GameStateDto> {
    const state = await this.session.getOrFail(gameId);
    return this.toStateDto(state);
  }

  // ==================================================================
  // Auxiliares privados
  // ==================================================================
  private async applySkip(state: GameSessionState): Promise<PowerupResultDto> {
    // A pergunta atual e apenas TROCADA: ja esta em servedQuestionIds (foi
    // adicionada em getNextQuestion) e por isso nao volta. Nao registra
    // game_answer nem incrementa "answered" — do ponto de vista da partida,
    // e como se essa pergunta nunca tivesse sido feita.
    state.currentQuestion = null;
    await this.session.save(state);

    const next = await this.getNextQuestion(state.gameId);
    return { powerup: 'skip', next, state: next.state };
  }

  private reachedEnd(state: GameSessionState): boolean {
    if (state.status === STATUS_FINISHED) return true;
    return state.numberQuestions !== null && state.answered >= state.numberQuestions;
  }

  /** Modo "adaptativo" simples: dificuldade sobe conforme o jogador avanca. */
  private difficultyForSequence(state: GameSessionState): number | undefined {
    if (state.answered < 3) return 1;
    if (state.answered < 6) return 2;
    if (state.answered < 9) return 3;
    if (state.answered < 12) return 4;
    return 5;
  }

  private resolveResponseTime(startedAt: number, clientMs?: number): number {
    const serverMs = Date.now() - startedAt;
    if (clientMs === undefined) return Math.max(0, serverMs);
    // Usa o menor valor plausivel para nao permitir inflar bonus de velocidade.
    return Math.max(0, Math.min(serverMs, clientMs));
  }

  // Minimo de respostas reais para exibir distribuicao "de verdade" na plateia.
  // Abaixo disso, a amostra e pequena demais para representar a "galera" e
  // caimos no fallback simulado.
  private static readonly AUDIENCE_MIN_SAMPLES = 30;

  private async simulateAudience(questionId: number): Promise<Record<number, number>> {
    // 1) Tenta usar a distribuicao real de respostas do banco.
    const rows = await this.answerRepo
      .createQueryBuilder('a')
      .select('a.optionId', 'optionId')
      .addSelect('COUNT(*)', 'count')
      .where('a.question = :questionId', { questionId })
      .andWhere('a.option IS NOT NULL')
      .groupBy('a.optionId')
      .getRawMany<{ optionId: string; count: string }>();

    const total = rows.reduce((sum, r) => sum + Number.parseInt(r.count, 10), 0);
    if (total >= GameService.AUDIENCE_MIN_SAMPLES) {
      const distribution: Record<number, number> = {};
      for (const r of rows) {
        distribution[Number.parseInt(r.optionId, 10)] = Math.round(
          (Number.parseInt(r.count, 10) / total) * 100,
        );
      }
      return distribution;
    }

    // 2) Fallback: simula "placar da galera" com viés para a resposta correta.
    const question = await this.questionsService.findOne(questionId);
    const correctId = question.answerOptionId;
    const options = question.options;
    const correctShare = 55 + Math.floor(Math.random() * 20); // 55-74%
    const remaining = 100 - correctShare;
    const others = options.filter((o) => o.id !== correctId);
    const distribution: Record<number, number> = {};

    let allocated = 0;
    others.forEach((option, index) => {
      const isLast = index === others.length - 1;
      const share = isLast
        ? remaining - allocated
        : Math.floor(Math.random() * (remaining - allocated - (others.length - index - 1)));
      distribution[option.id] = Math.max(0, share);
      allocated += distribution[option.id];
    });
    if (correctId != null) distribution[correctId] = correctShare;
    return distribution;
  }

  private async persistAnswer(params: {
    gameId: string;
    questionId: number;
    optionId: number | null;
    isCorrect: boolean;
    responseTimeMs: number;
    sequence: number;
    powerupName: string | null;
  }): Promise<void> {
    const powerup = params.powerupName
      ? await this.powerupsService.findByName(params.powerupName)
      : null;

    await this.answerRepo.save(
      this.answerRepo.create({
        game: { id: params.gameId } as Game,
        question: { id: params.questionId } as never,
        option: params.optionId ? ({ id: params.optionId } as never) : null,
        isCorrect: params.isCorrect,
        responseTimeMs: params.responseTimeMs,
        sequence: params.sequence,
        powerupUsed: powerup ? ({ id: powerup.id } as Powerup) : null,
      }),
    );
  }

  private async updateGameProgress(gameId: string, score: number, streak: number): Promise<void> {
    await this.gameRepo.update({ id: gameId }, { currentScore: score, currentStreak: streak });
  }

  private async markGamePowerupUsed(gameId: string, powerupName: string): Promise<void> {
    const powerup = await this.powerupsService.findByName(powerupName);
    if (!powerup) return;
    await this.gamePowerupRepo.update(
      { game: { id: gameId }, powerup: { id: powerup.id }, isUsed: false },
      { isUsed: true },
    );
  }

  private async getStatus(label: string): Promise<GameStatus> {
    const status = await this.statusRepo.findOne({ where: { label } });
    if (!status) {
      throw new NotFoundException(`game_status '${label}' ausente. Rode a seed (npm run seed).`);
    }
    return status;
  }

  private toStateDto(state: GameSessionState): GameStateDto {
    return {
      gameId: state.gameId,
      score: state.score,
      streak: state.streak,
      answered: state.answered,
      totalQuestions: state.numberQuestions,
      powerups: state.powerups,
      status: state.status,
      endsOnWrong: state.endsOnWrong,
    };
  }
}
