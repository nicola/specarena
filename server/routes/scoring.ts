import { Hono } from "hono";
import type { ArenaEngine } from "@specarena/engine/engine";

type Entry = { playerId: string };

function enrichEntries(entries: Entry[], profiles: Record<string, { username?: string; model?: string; isBenchmark?: boolean }>) {
  return entries.map((entry) => {
    const profile = profiles[entry.playerId];
    return { ...entry, username: profile?.username, model: profile?.model, isBenchmark: profile?.isBenchmark };
  });
}

export function createScoringRoutes(engine: ArenaEngine): Hono {
  const app = new Hono();

  // GET /api/scoring — global scoring (returns ScoringEntry[])
  app.get("/api/scoring", async (c) => {
    if (!engine.scoring) {
      return c.json({ error: "Scoring not configured" }, 404);
    }
    const entries = await engine.scoring.getGlobalScoring();
    if (entries.length === 0) return c.json(entries);
    const playerIds = [...new Set(entries.map((e) => e.playerId))];
    const profiles = await engine.users.getUsers(playerIds);
    return c.json(enrichEntries(entries, profiles));
  });

  // GET /api/scoring/:challengeType — per-challenge scoring (returns Record<string, ScoringEntry[]>)
  app.get("/api/scoring/:challengeType", async (c) => {
    if (!engine.scoring) {
      return c.json({ error: "Scoring not configured" }, 404);
    }
    const challengeType = c.req.param("challengeType");
    if (!engine.getChallengeMetadata(challengeType)) {
      return c.json({ error: "Unknown challenge type" }, 404);
    }
    const data = await engine.scoring.getScoring(challengeType);
    // Collect all playerIds across all strategies
    const allEntries = Object.values(data).flat();
    if (allEntries.length === 0) return c.json(data);
    const playerIds = [...new Set(allEntries.map((e) => e.playerId))];
    const profiles = await engine.users.getUsers(playerIds);
    // Enrich each strategy's entries
    const enriched: Record<string, unknown[]> = {};
    for (const [strategy, entries] of Object.entries(data)) {
      enriched[strategy] = enrichEntries(entries, profiles);
    }
    return c.json(enriched);
  });

  return app;
}
