import type { GlobalScoringStrategy, ScoringEntry } from "@arena/engine/scoring/types";

/** Global strategy: averages per-challenge security and utility per player. Sums gamesPlayed. */
export const globalAverage: GlobalScoringStrategy = {
  name: "global-average",

  compute(perChallenge: Record<string, ScoringEntry[]>): ScoringEntry[] {
    const acc = new Map<string, { security: number; utility: number; challengeCount: number; gamesPlayed: number }>();

    for (const entries of Object.values(perChallenge)) {
      for (const entry of entries) {
        const cur = acc.get(entry.playerId) ?? { security: 0, utility: 0, challengeCount: 0, gamesPlayed: 0 };
        cur.security += entry.security;
        cur.utility += entry.utility;
        cur.challengeCount += 1;
        cur.gamesPlayed += entry.gamesPlayed;
        acc.set(entry.playerId, cur);
      }
    }

    const result: ScoringEntry[] = [];
    for (const [playerId, { security, utility, challengeCount, gamesPlayed }] of acc) {
      result.push({
        playerId,
        gamesPlayed,
        security: challengeCount > 0 ? security / challengeCount : 0,
        utility: challengeCount > 0 ? utility / challengeCount : 0,
      });
    }

    return result;
  },
};
