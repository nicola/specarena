import type { ScoringStrategy, GameResult, ScoringStorageAdapter } from "./types";
import { resolvePlayerIds, countBreaches } from "./utils";

interface RedTeamState {
  breaches: number;       // times this player caused a security breach
  timesBreached: number;  // times this player was breached
  gamesPlayed: number;
}

/** Per-challenge strategy: tracks red-team (attack) effectiveness via attributions. */
export const redTeam: ScoringStrategy = {
  name: "red-team",
  metrics: [
    { key: "red-team:attack", label: "Attack Rate" },
    { key: "red-team:defend", label: "Defend Rate" },
  ],

  async update(result: GameResult, store: ScoringStorageAdapter): Promise<void> {
    if (result.players.length < 2) return;

    const playerIds = resolvePlayerIds(result);
    if (!playerIds) return;

    const { breachesBy, breachesOn } = countBreaches(result, playerIds);

    // Update state for all participants
    const seen = new Set<string>();
    for (const playerId of playerIds) {
      if (!playerId || seen.has(playerId)) continue;
      seen.add(playerId);

      const prev = await store.getStrategyState<RedTeamState>(result.challengeType, this.name, playerId);
      const state: RedTeamState = {
        breaches: (prev?.breaches ?? 0) + (breachesBy.get(playerId) ?? 0),
        timesBreached: (prev?.timesBreached ?? 0) + (breachesOn.get(playerId) ?? 0),
        gamesPlayed: (prev?.gamesPlayed ?? 0) + 1,
      };

      await store.setStrategyState(result.challengeType, this.name, playerId, state);
      await store.setScoreEntry(result.challengeType, this.name, {
        playerId,
        gamesPlayed: state.gamesPlayed,
        metrics: {
          "red-team:attack": state.breaches / state.gamesPlayed,
          "red-team:defend": 1 - state.timesBreached / state.gamesPlayed,
        },
      });
    }
  },
};
