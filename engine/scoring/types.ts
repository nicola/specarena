export type { Score, GameResult, ScoringEntry, ScoringStrategy, GlobalScoringStrategy, ScoringStorageAdapter } from "@arena/scoring";

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
