import type { ScoringStrategy, GameResult, ScoringStorageAdapter } from "./types";

interface WinRateState {
  wins: Record<string, number>;
  count: number;
}

/** Threshold-based win: score >= 1 counts as a win, otherwise a loss. */
function isWin(score: number): number {
  return score >= 1 ? 1 : 0;
}

/** Per-challenge strategy: fraction of games where each player achieved score >= 1 per dimension. */
export const winRate: ScoringStrategy = {
  name: "win-rate",
  metrics: [
    { key: "win-rate:utility", label: "Utility Win Rate" },
  ],

  async update(result: GameResult, store: ScoringStorageAdapter): Promise<void> {
    for (let i = 0; i < result.players.length; i++) {
      const playerId = result.playerIdentities[result.players[i]];
      if (!playerId) continue;

      const score = result.scores[i];
      if (!score) continue;

      const prev = await store.getStrategyState<WinRateState>(result.challengeType, this.name, playerId);
      const wins: Record<string, number> = { ...(prev?.wins ?? {}) };
      for (const [dim, val] of Object.entries(score)) {
        wins[dim] = (wins[dim] ?? 0) + isWin(val);
      }
      const count = (prev?.count ?? 0) + 1;
      const state: WinRateState = { wins, count };

      await store.setStrategyState(result.challengeType, this.name, playerId, state);

      const metrics: Record<string, number> = {};
      for (const [dim, w] of Object.entries(wins)) {
        metrics[`win-rate:${dim}`] = w / count;
      }

      await store.setScoreEntry(result.challengeType, this.name, {
        playerId,
        gamesPlayed: count,
        metrics,
      });
    }
  },
};
