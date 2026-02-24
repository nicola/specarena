import type { ScoringStrategy, GlobalScoringStrategy } from "@arena/engine/scoring/types";
import { average } from "./average";
import { winRate } from "./win-rate";
import { globalAverage } from "./global-average";

export const strategies: Record<string, ScoringStrategy> = {
  average,
  "win-rate": winRate,
};

export const globalStrategies: Record<string, GlobalScoringStrategy> = {
  "global-average": globalAverage,
};
