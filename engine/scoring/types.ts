export type { Score, GameResult, PlayerScores, ScoringEntry, MetricDescriptor, ScoringStrategy, GlobalScoringStrategy, ScoringStorageAdapter } from "@arena/scoring";

export interface ScoringConfig {
  default: string[];
  global?: string;
  globalSource?: string; // which per-challenge strategy feeds the global aggregation (defaults to first in default[])
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
