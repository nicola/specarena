import { GAMES_PLAYED_KEY, type GlobalScoringStrategy, type GameResult, type ScoringStorageAdapter } from "./types";

interface GlobalAvgState {
  /** Sum of per-challenge metric values, keyed by metric key (remapped to global-average:*) */
  metricSums: Record<string, number>;
  challengeCount: number;
  totalGames: number;
  prevMetrics: Record<string, Record<string, number>>;
}

/** Global strategy: averages per-challenge metrics per player. Sums gamesPlayed. */
export const globalAverage: GlobalScoringStrategy = {
  name: "global-average",
  metrics: [
    { key: "global-average:security", label: "Security" },
    { key: "global-average:utility", label: "Utility" },
  ],

  async update(result: GameResult, store: ScoringStorageAdapter, challengeStrategyName: string): Promise<void> {
    const playerIds = new Set<string>();
    for (const invite of result.players) {
      const pid = result.playerIdentities[invite];
      if (pid) playerIds.add(pid);
    }

    for (const playerId of playerIds) {
      const current = await store.getScoreEntry(result.challengeType, challengeStrategyName, playerId);
      if (!current) continue;

      const state = await store.getGlobalStrategyState<GlobalAvgState>(playerId)
        ?? { metricSums: {}, challengeCount: 0, totalGames: 0, prevMetrics: {} };

      const currentGames = current.metrics[GAMES_PLAYED_KEY] ?? 0;
      const prev = state.prevMetrics[result.challengeType];
      if (prev) {
        // Subtract old values, add new values
        for (const [key, value] of Object.entries(current.metrics)) {
          if (key === GAMES_PLAYED_KEY) continue;
          const globalKey = remapKey(challengeStrategyName, key);
          state.metricSums[globalKey] = (state.metricSums[globalKey] ?? 0) + value - (prev[key] ?? 0);
        }
        state.totalGames += currentGames - (prev[GAMES_PLAYED_KEY] ?? 0);
      } else {
        // First time seeing this challenge for this player
        for (const [key, value] of Object.entries(current.metrics)) {
          if (key === GAMES_PLAYED_KEY) continue;
          const globalKey = remapKey(challengeStrategyName, key);
          state.metricSums[globalKey] = (state.metricSums[globalKey] ?? 0) + value;
        }
        state.totalGames += currentGames;
        state.challengeCount += 1;
      }

      state.prevMetrics[result.challengeType] = { ...current.metrics };

      await store.setGlobalStrategyState(playerId, state);

      const metrics: Record<string, number> = {
        [GAMES_PLAYED_KEY]: state.totalGames,
      };
      for (const [key, sum] of Object.entries(state.metricSums)) {
        metrics[key] = state.challengeCount > 0 ? sum / state.challengeCount : 0;
      }

      await store.setGlobalScoreEntry({
        playerId,
        metrics,
      });
    }
  },
};

/** Remap a per-challenge metric key to a global one: "average:security" → "global-average:security" */
function remapKey(strategyName: string, metricKey: string): string {
  // Strip the strategy prefix and replace with global-average
  const colonIdx = metricKey.indexOf(":");
  if (colonIdx === -1) return `global-average:${metricKey}`;
  const dimension = metricKey.slice(colonIdx + 1);
  return `global-average:${dimension}`;
}
