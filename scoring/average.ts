import type { ScoringStrategy, ScoringOptions, GameResult, ScoringStorageAdapter } from "./types";

interface AverageState {
  sumSecurity: number;
  sumUtility: number;
  count: number;
}

/** Per-challenge strategy: mean security + utility per player across all their games. */
export const average: ScoringStrategy = {
  name: "average",
  metrics: [
    { key: "average:security", label: "Security" },
    { key: "average:utility", label: "Utility" },
    { key: "average:combined", label: "Combined" },
  ],

  async update(result: GameResult, store: ScoringStorageAdapter, options?: ScoringOptions): Promise<void> {
    const securityWeight = options?.securityWeight ?? 1.0;
    const utilityWeight = options?.utilityWeight ?? 1.0;
    const totalWeight = securityWeight + utilityWeight;

    for (let i = 0; i < result.players.length; i++) {
      const playerId = result.playerIdentities[result.players[i]];
      if (!playerId) continue;

      const score = result.scores[i];
      if (!score) continue;

      const prev = await store.getStrategyState<AverageState>(result.challengeType, this.name, playerId);
      const state: AverageState = {
        sumSecurity: (prev?.sumSecurity ?? 0) + score.security,
        sumUtility: (prev?.sumUtility ?? 0) + score.utility,
        count: (prev?.count ?? 0) + 1,
      };

      const avgSecurity = state.sumSecurity / state.count;
      const avgUtility = state.sumUtility / state.count;
      const combined = totalWeight > 0
        ? (avgSecurity * securityWeight + avgUtility * utilityWeight) / totalWeight
        : 0;

      await store.setStrategyState(result.challengeType, this.name, playerId, state);
      await store.setScoreEntry(result.challengeType, this.name, {
        playerId,
        gamesPlayed: state.count,
        metrics: {
          "average:security": avgSecurity,
          "average:utility": avgUtility,
          "average:combined": combined,
        },
      });
    }
  },
};
