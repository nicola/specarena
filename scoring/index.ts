import type { ScoringStrategy, GlobalScoringStrategy } from "./types";
import { average } from "./average";
import { winRate } from "./win-rate";
import { redTeam } from "./red-team";
import { globalAverage } from "./global-average";

export const strategies: Record<string, ScoringStrategy> = {
  average,
  "win-rate": winRate,
  "red-team": redTeam,
};

export const globalStrategies: Record<string, GlobalScoringStrategy> = {
  "global-average": globalAverage,
};

export type { Score, GameResult, PlayerScores, ScoringEntry, ScoringStrategy, GlobalScoringStrategy, ScoringStorageAdapter } from "./types";
export { InMemoryScoringStore } from "./store";
