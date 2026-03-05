import type { ScoringStrategy, GameResult, ScoringStorageAdapter } from "./types";

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
  ],

  async update(result: GameResult, store: ScoringStorageAdapter): Promise<void> {
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

      await store.setStrategyState(result.challengeType, this.name, playerId, state);
      await store.setScoreEntry(result.challengeType, this.name, {
        playerId,
        metrics: {
          "games_played:count": state.count,
          "average:security": state.sumSecurity / state.count,
          "average:utility": state.sumUtility / state.count,
        },
      });
    }
  },
};
