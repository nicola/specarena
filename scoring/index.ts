import type { ScoringStrategy, GlobalScoringStrategy } from "./types";
import { average } from "./average";
import { winRate } from "./win-rate";
import { redTeam } from "./red-team";
import { consecutive } from "./consecutive";
import { globalAverage } from "./global-average";

export const strategies: Record<string, ScoringStrategy> = {
  average,
  "win-rate": winRate,
  "red-team": redTeam,
  consecutive,
};

export const globalStrategies: Record<string, GlobalScoringStrategy> = {
  "global-average": globalAverage,
};

export type { Score, Attribution, GameResult, PlayerScores, ScoringEntry, MetricDescriptor, ScoringStrategy, GlobalScoringStrategy, ScoringStorageAdapter, ScoringOptions } from "./types";
export { InMemoryScoringStore } from "./store";
