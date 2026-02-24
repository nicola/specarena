import type { ScoringStrategy, GameResult, ScoringEntry } from "@arena/engine/scoring/types";

/** Per-challenge strategy: win fraction for 2-player games per dimension. Ties = 0.5. */
export const winRate: ScoringStrategy = {
  name: "win-rate",

  compute(results: GameResult[]): ScoringEntry[] {
    const acc = new Map<string, { securityWins: number; utilityWins: number; count: number }>();

    for (const result of results) {
      if (result.players.length !== 2) continue;

      const id0 = result.playerIdentities[result.players[0]];
      const id1 = result.playerIdentities[result.players[1]];
      if (!id0 || !id1) continue;

      const s0 = result.scores[0];
      const s1 = result.scores[1];
      if (!s0 || !s1) continue;

      const e0 = acc.get(id0) ?? { securityWins: 0, utilityWins: 0, count: 0 };
      const e1 = acc.get(id1) ?? { securityWins: 0, utilityWins: 0, count: 0 };

      // Security dimension
      if (s0.security > s1.security) {
        e0.securityWins += 1;
      } else if (s1.security > s0.security) {
        e1.securityWins += 1;
      } else {
        e0.securityWins += 0.5;
        e1.securityWins += 0.5;
      }

      // Utility dimension
      if (s0.utility > s1.utility) {
        e0.utilityWins += 1;
      } else if (s1.utility > s0.utility) {
        e1.utilityWins += 1;
      } else {
        e0.utilityWins += 0.5;
        e1.utilityWins += 0.5;
      }

      e0.count += 1;
      e1.count += 1;
      acc.set(id0, e0);
      acc.set(id1, e1);
    }

    const entries: ScoringEntry[] = [];
    for (const [playerId, { securityWins, utilityWins, count }] of acc) {
      entries.push({
        playerId,
        gamesPlayed: count,
        security: count > 0 ? securityWins / count : 0,
        utility: count > 0 ? utilityWins / count : 0,
      });
    }

    return entries;
  },
};
