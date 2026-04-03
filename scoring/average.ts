import type { ScoringStrategy, GameResult, ScoringStorageAdapter } from "./types";

interface AverageState {
  sums: Record<string, number>;
  count: number;
}

/** Per-challenge strategy: mean score per dimension per player across all their games. */
export const average: ScoringStrategy = {
  name: "average",
  metrics: [
    { key: "average:utility", label: "Utility" },
  ],

  async update(result: GameResult, store: ScoringStorageAdapter): Promise<void> {
    for (let i = 0; i < result.players.length; i++) {
      const playerId = result.playerIdentities[result.players[i]];
      if (!playerId) continue;

      const score = result.scores[i];
      if (!score) continue;

      const prev = await store.getStrategyState<AverageState>(result.challengeType, this.name, playerId);
      const sums: Record<string, number> = { ...(prev?.sums ?? {}) };
      for (const [dim, val] of Object.entries(score)) {
        sums[dim] = (sums[dim] ?? 0) + val;
      }
      const count = (prev?.count ?? 0) + 1;
      const state: AverageState = { sums, count };

      await store.setStrategyState(result.challengeType, this.name, playerId, state);

      const metrics: Record<string, number> = {};
      for (const [dim, sum] of Object.entries(sums)) {
        metrics[`average:${dim}`] = sum / count;
      }

      await store.setScoreEntry(result.challengeType, this.name, {
        playerId,
        gamesPlayed: count,
        metrics,
      });
    }
  },
};
