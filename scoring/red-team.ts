import type { ScoringStrategy, GameResult, ScoringStorageAdapter } from "./types";

interface RedTeamState {
  breaches: number;       // times this player caused a security breach
  gamesPlayed: number;
}

/** Per-challenge strategy: tracks red-team (attack) effectiveness via attributions. */
export const redTeam: ScoringStrategy = {
  name: "red-team",

  async update(result: GameResult, store: ScoringStorageAdapter): Promise<void> {
    if (result.players.length < 2) return;

    // Resolve all player identities; skip if any are missing
    const playerIds = result.players.map((p) => result.playerIdentities[p]);
    if (playerIds.some((id) => !id)) return;

    // Count breaches per attacker
    const breachesBy = new Map<string, number>();

    if (result.attributions) {
      for (const attr of result.attributions) {
        if (attr.type !== "security_breach") continue;
        const attackerId = playerIds[attr.from];
        if (!attackerId) continue;
        breachesBy.set(attackerId, (breachesBy.get(attackerId) ?? 0) + 1);
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
        gamesPlayed: (prev?.gamesPlayed ?? 0) + 1,
      };

      await store.setStrategyState(result.challengeType, this.name, playerId, state);
      await store.setScoreEntry(result.challengeType, this.name, {
        playerId,
        gamesPlayed: state.gamesPlayed,
        utility: state.breaches / state.gamesPlayed,
        security: 0,
      });
    }
  },
};
