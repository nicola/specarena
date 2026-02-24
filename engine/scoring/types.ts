import { Score } from "../types";

/** Matches the shape emitted by endGame() + metadata. */
export interface GameResult {
  gameId: string;
  challengeType: string;
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

/** Per-challenge: GameResult[] → ScoringEntry[] */
export interface ScoringStrategy {
  readonly name: string;
  compute(results: GameResult[]): ScoringEntry[];
}

/** Global: per-challenge scores → combined ScoringEntry[] */
export interface GlobalScoringStrategy {
  readonly name: string;
  compute(perChallenge: Record<string, ScoringEntry[]>): ScoringEntry[];
}

export interface ScoringConfig {
  default: string[];
  global?: string;
}

export interface ChallengeConfigEntry {
  name: string;
  options?: Record<string, unknown>;
  scoring?: string[];
}

export interface EngineConfig {
  challenges: ChallengeConfigEntry[];
  scoring: ScoringConfig;
}
