import type { ScoringStrategy, GameResult } from "@arena/engine/scoring/types";
import type { ScoringStorageAdapter } from "@arena/engine/scoring";

interface WinRateState {
  securityWins: number;
  utilityWins: number;
  count: number;
}

/** 1 for win, 0 for loss, 0.5 for tie. */
function dimensionWin(a: number, b: number): [number, number] {
  if (a > b) return [1, 0];
  if (b > a) return [0, 1];
  return [0.5, 0.5];
}

/** Per-challenge strategy: win fraction for 2-player games per dimension. Ties = 0.5. */
export const winRate: ScoringStrategy = {
  name: "win-rate",

  async update(result: GameResult, store: ScoringStorageAdapter): Promise<void> {
    if (result.players.length !== 2) return;

    const id0 = result.playerIdentities[result.players[0]];
    const id1 = result.playerIdentities[result.players[1]];
    if (!id0 || !id1) return;

    const s0 = result.scores[0];
    const s1 = result.scores[1];
    if (!s0 || !s1) return;

    const [secWin0, secWin1] = dimensionWin(s0.security, s1.security);
    const [utilWin0, utilWin1] = dimensionWin(s0.utility, s1.utility);

    const updates: [string, number, number][] = [
      [id0, secWin0, utilWin0],
      [id1, secWin1, utilWin1],
    ];

    for (const [playerId, secWin, utilWin] of updates) {
      const prev = await store.getStrategyState<WinRateState>(result.challengeType, this.name, playerId);
      const state: WinRateState = {
        securityWins: (prev?.securityWins ?? 0) + secWin,
        utilityWins: (prev?.utilityWins ?? 0) + utilWin,
        count: (prev?.count ?? 0) + 1,
      };

      await store.setStrategyState(result.challengeType, this.name, playerId, state);
      await store.setScoreEntry(result.challengeType, this.name, {
        playerId,
        gamesPlayed: state.count,
        security: state.securityWins / state.count,
        utility: state.utilityWins / state.count,
      });
    }
  },
};
