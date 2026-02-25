import type { GlobalScoringStrategy, GameResult, ScoringStorageAdapter } from "./types";

interface ChallengeSnapshot {
  security: number;
  utility: number;
  gamesPlayed: number;
}

interface GlobalAvgState {
  sumSecurity: number;
  sumUtility: number;
  challengeCount: number;
  totalGames: number;
  prevScores: Record<string, ChallengeSnapshot>;
}

/** Global strategy: averages per-challenge security and utility per player. Sums gamesPlayed. */
export const globalAverage: GlobalScoringStrategy = {
  name: "global-average",

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
        ?? { sumSecurity: 0, sumUtility: 0, challengeCount: 0, totalGames: 0, prevScores: {} };

      const prev = state.prevScores[result.challengeType];
      if (prev) {
        state.sumSecurity += current.security - prev.security;
        state.sumUtility += current.utility - prev.utility;
        state.totalGames += current.gamesPlayed - prev.gamesPlayed;
      } else {
        state.sumSecurity += current.security;
        state.sumUtility += current.utility;
        state.totalGames += current.gamesPlayed;
        state.challengeCount += 1;
      }

      state.prevScores[result.challengeType] = {
        security: current.security,
        utility: current.utility,
        gamesPlayed: current.gamesPlayed,
      };

      await store.setGlobalStrategyState(playerId, state);
      await store.setGlobalScoreEntry({
        playerId,
        gamesPlayed: state.totalGames,
        security: state.challengeCount > 0 ? state.sumSecurity / state.challengeCount : 0,
        utility: state.challengeCount > 0 ? state.sumUtility / state.challengeCount : 0,
      });
    }
  },
};
