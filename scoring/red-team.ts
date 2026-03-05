import { GAMES_PLAYED_KEY, type ScoringStrategy, type GameResult, type ScoringStorageAdapter } from "./types";

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

    // Resolve all player identities; skip if any are missing
    const playerIds = result.players.map((p) => result.playerIdentities[p]);
    if (playerIds.some((id) => !id)) return;

    // Count breaches per attacker and per victim
    const breachesBy = new Map<string, number>();
    const breachesOn = new Map<string, number>();

    if (result.attributions) {
      for (const attr of result.attributions) {
        if (attr.type !== "security_breach") continue;
        const attackerId = playerIds[attr.from];
        const victimId = playerIds[attr.to];
        if (!attackerId || !victimId) continue;
        breachesBy.set(attackerId, (breachesBy.get(attackerId) ?? 0) + 1);
        breachesOn.set(victimId, (breachesOn.get(victimId) ?? 0) + 1);
      }
    }

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
        metrics: {
          [GAMES_PLAYED_KEY]: state.gamesPlayed,
          "red-team:attack": state.breaches / state.gamesPlayed,
          "red-team:defend": 1 - state.timesBreached / state.gamesPlayed,
        },
      });
    }
  },
};
