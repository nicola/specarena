import type { ScoringStrategy, GameResult, ScoringStorageAdapter } from "./types";

interface WinRateState {
  securityWins: number;
  utilityWins: number;
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
    { key: "win-rate:security", label: "Security Win Rate" },
    { key: "win-rate:utility", label: "Utility Win Rate" },
  ],

  async update(result: GameResult, store: ScoringStorageAdapter): Promise<void> {
    for (let i = 0; i < result.players.length; i++) {
      const playerId = result.playerIdentities[result.players[i]];
      if (!playerId) continue;

      const score = result.scores[i];
      if (!score) continue;

      const prev = await store.getStrategyState<WinRateState>(result.challengeType, this.name, playerId);
      const state: WinRateState = {
        securityWins: (prev?.securityWins ?? 0) + isWin(score.security),
        utilityWins: (prev?.utilityWins ?? 0) + isWin(score.utility),
        count: (prev?.count ?? 0) + 1,
      };

      await store.setStrategyState(result.challengeType, this.name, playerId, state);
      await store.setScoreEntry(result.challengeType, this.name, {
        playerId,
        gamesPlayed: state.count,
        metrics: {
          "win-rate:security": state.securityWins / state.count,
          "win-rate:utility": state.utilityWins / state.count,
        },
      });
    }
  },
};
