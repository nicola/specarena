import type { ScoringStrategy, GameResult, ScoringStorageAdapter } from "./types";

/** Per-challenge strategy: tracks current streak of consecutive successful games. */
export const consecutive: ScoringStrategy = {
  name: "consecutive",
  metrics: [
    { key: "consecutive:security", label: "Security Streak" },
    { key: "consecutive:utility", label: "Utility Streak" },
    { key: "consecutive:attack", label: "Attack Streak" },
  ],

  async update(result: GameResult, store: ScoringStorageAdapter): Promise<void> {
    if (result.players.length < 2) return;

    // Resolve player identities; skip if any are missing
    const playerIds = result.players.map((p) => result.playerIdentities[p]);
    if (playerIds.some((id) => !id)) return;

    // Count breaches per attacker (same attribution scan as red-team)
    const breachesBy = new Map<string, number>();
    if (result.attributions) {
      for (const attr of result.attributions) {
        if (attr.type !== "security_breach") continue;
        const attackerId = playerIds[attr.from];
        if (!attackerId) continue;
        breachesBy.set(attackerId, (breachesBy.get(attackerId) ?? 0) + 1);
      }
    }

    // Update streaks for all participants
    const seen = new Set<string>();
    for (let i = 0; i < result.players.length; i++) {
      const playerId = playerIds[i];
      if (!playerId || seen.has(playerId)) continue;
      seen.add(playerId);

      const score = result.scores[i];
      if (!score) continue;

      const prev = await store.getScoreEntry(result.challengeType, this.name, playerId);
      const prevMetrics = prev?.metrics ?? {};

      const security = score.security >= 1 ? (prevMetrics["consecutive:security"] ?? 0) + 1 : 0;
      const utility = score.utility >= 1 ? (prevMetrics["consecutive:utility"] ?? 0) + 1 : 0;
      const attack = (breachesBy.get(playerId) ?? 0) > 0 ? (prevMetrics["consecutive:attack"] ?? 0) + 1 : 0;

      await store.setScoreEntry(result.challengeType, this.name, {
        playerId,
        gamesPlayed: (prev?.gamesPlayed ?? 0) + 1,
        metrics: {
          "consecutive:security": security,
          "consecutive:utility": utility,
          "consecutive:attack": attack,
        },
      });
    }
  },
};
