/** Estado da pergunta atualmente em jogo (vive apenas no Redis). */
export interface CurrentQuestionState {
  questionId: number;
  difficulty: number;
  /** epoch em ms de quando a pergunta foi servida — base do response_time_ms. */
  startedAt: number;
  /** Opcoes removidas pelo power-up 50:50 (nao contam como resposta). */
  removedOptionIds: number[];
  /** Nome do power-up aplicado nesta pergunta (ou null). */
  powerupUsed: string | null;
}

export type GameSessionStatus = 'in_progress' | 'finished';

/**
 * Estado completo de uma partida em andamento, mantido no Redis para leitura e
 * escrita de baixa latencia durante o jogo em tempo real. A verdade definitiva
 * (respostas, pontuacao final, ranking) e persistida no PostgreSQL.
 */
export interface GameSessionState {
  gameId: string;
  userId: number;
  difficultyId: string;
  educationLevelId: number | null;
  /** Quantidade total de perguntas do modo; null = infinito (endless). */
  numberQuestions: number | null;
  /** Se true, a partida encerra na primeira resposta errada (Sobrevivencia). */
  endsOnWrong: boolean;
  score: number;
  streak: number;
  /** Quantas perguntas ja foram respondidas (vira o "sequence" da resposta). */
  answered: number;
  servedQuestionIds: number[];
  currentQuestion: CurrentQuestionState | null;
  /** Saldo de ajudas: nome do power-up -> ainda disponivel? */
  powerups: Record<string, boolean>;
  status: GameSessionStatus;
}
