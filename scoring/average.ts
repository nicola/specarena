import type { ScoringStrategy, GameResult, ScoringEntry } from "@arena/engine/scoring/types";

/** Per-challenge strategy: mean security + utility per player across all their games. */
export const average: ScoringStrategy = {
  name: "average",

  compute(results: GameResult[]): ScoringEntry[] {
    const acc = new Map<string, { security: number; utility: number; count: number }>();

    for (const result of results) {
      for (let i = 0; i < result.players.length; i++) {
        const playerId = result.playerIdentities[result.players[i]];
        if (!playerId) continue;

        const score = result.scores[i];
        if (!score) continue;

        const entry = acc.get(playerId) ?? { security: 0, utility: 0, count: 0 };
        entry.security += score.security;
        entry.utility += score.utility;
        entry.count += 1;
        acc.set(playerId, entry);
      }
    }

    const entries: ScoringEntry[] = [];
    for (const [playerId, { security, utility, count }] of acc) {
      entries.push({
        playerId,
        gamesPlayed: count,
        security: count > 0 ? security / count : 0,
        utility: count > 0 ? utility / count : 0,
      });
    }

    return entries;
  },
};
