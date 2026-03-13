export type { Score, GameResult, PlayerScores, ScoringEntry, MetricDescriptor, ScoringStrategy, GlobalScoringStrategy, ScoringStorageAdapter, ScoringOptions } from "@arena/scoring";

export interface ScoringConfig {
  default: string[];
  global?: string;
  globalSource?: string; // which per-challenge strategy feeds the global aggregation (defaults to first in default[])
}

export interface ChallengeConfigEntry {
  name: string;
  options?: Record<string, unknown>;
  scoring?: string[];
  /** Per-challenge options forwarded to scoring strategies (e.g. securityWeight, utilityWeight). */
  scoringOptions?: Record<string, unknown>;
}

export interface EngineConfig {
  challenges: ChallengeConfigEntry[];
  scoring: ScoringConfig;
}
