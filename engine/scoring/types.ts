import { Score } from "../types";
import type { ScoringStorageAdapter } from "./store";

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
