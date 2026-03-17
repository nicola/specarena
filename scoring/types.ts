export interface Score {
  security: number;
  utility: number;
}

export interface Attribution {
  from: number;   // attacker player index
  to: number;     // victim player index
  type: string;   // e.g. "security_breach"
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
  attributions?: Attribution[];
}

export interface MetricDescriptor {
  key: string;
  label: string;
}

export interface ScoringEntry {
  playerId: string;
  gamesPlayed: number;
  metrics: Record<string, number>;
}

/** Per-challenge: incrementally update scores for one game result. */
export interface ScoringStrategy {
  readonly name: string;
  readonly metrics: MetricDescriptor[];
  update(result: GameResult, store: ScoringStorageAdapter): Promise<void>;
}

/** Global: incrementally update global scores for one game result. */
export interface GlobalScoringStrategy {
  readonly name: string;
  readonly metrics: MetricDescriptor[];
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
  getGlobalScoreEntry(playerId: string): Promise<ScoringEntry | undefined>;
}

export interface PlayerScores {
  global: ScoringEntry | null;
  challenges: Record<string, Record<string, ScoringEntry>>;
}

/**
 * Shared win-threshold predicate used by scoring strategies.
 *
 * A score dimension counts as a "win" when it reaches the maximum possible
 * value (>= 1).  Challenges that use fractional scores (e.g. Ultimatum with
 * 0.5) intentionally do NOT qualify — partial success is not a win for
 * streak / win-rate purposes.  If a challenge needs a lower bar it should
 * either normalise its scores to 0-or-1 before emitting a GameResult, or
 * use a strategy (like `average`) that does not apply a threshold.
 */
export function isWin(score: number): boolean {
  return score >= 1;
}
