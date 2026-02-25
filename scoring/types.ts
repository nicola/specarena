export interface Score {
  security: number;
  utility: number;
}

/** Matches the shape emitted by endGame() + metadata. */
export interface GameResult {
  gameId: string;
  challengeType: string;
  createdAt: number;
  completedAt: number;
  scores: Score[];
  players: string[];
  playerIdentities: Record<string, string>;
}

export interface ScoringEntry {
  playerId: string;
  gamesPlayed: number;
  security: number;
  utility: number;
}

/** Per-challenge: incrementally update scores for one game result. */
export interface ScoringStrategy {
  readonly name: string;
  update(result: GameResult, store: ScoringStorageAdapter): Promise<void>;
}

/** Global: incrementally update global scores for one game result. */
export interface GlobalScoringStrategy {
  readonly name: string;
  update(result: GameResult, store: ScoringStorageAdapter, challengeStrategyName: string): Promise<void>;
}

export interface ScoringStorageAdapter {
  getScores(challengeType: string): Promise<Record<string, ScoringEntry[]>>;
  getGlobalScores(): Promise<ScoringEntry[]>;
  clear(): Promise<void>;
  transaction<T>(fn: (store: ScoringStorageAdapter) => Promise<T>): Promise<T>;
  waitForIdle(): Promise<void>;

  getStrategyState<T>(challengeType: string, strategyName: string, playerId: string): Promise<T | undefined>;
  setStrategyState<T>(challengeType: string, strategyName: string, playerId: string, state: T): Promise<void>;
  getGlobalStrategyState<T>(playerId: string): Promise<T | undefined>;
  setGlobalStrategyState<T>(playerId: string, state: T): Promise<void>;
  setScoreEntry(challengeType: string, strategyName: string, entry: ScoringEntry): Promise<void>;
  getScoreEntry(challengeType: string, strategyName: string, playerId: string): Promise<ScoringEntry | undefined>;
  setGlobalScoreEntry(entry: ScoringEntry): Promise<void>;
}
