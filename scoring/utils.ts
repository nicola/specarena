import type { GameResult } from "./types";

/** Resolve player identities from a game result. Returns null if any are missing. */
export function resolvePlayerIds(result: GameResult): string[] | null {
  const playerIds = result.players.map((p) => result.playerIdentities[p]);
  if (playerIds.some((id) => !id)) return null;
  return playerIds;
}

/** Count security_breach attributions per attacker and per victim. */
export function countBreaches(
  result: GameResult,
  playerIds: string[],
): { breachesBy: Map<string, number>; breachesOn: Map<string, number> } {
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

  return { breachesBy, breachesOn };
}
