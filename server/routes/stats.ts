import { Hono } from "hono";
import type { ArenaEngine } from "@specarena/engine/engine";

export function createStatsRoutes(engine: ArenaEngine): Hono {
  const app = new Hono();

  // GET /api/stats — global and per-challenge statistics
  app.get("/api/stats", async (c) => {
    const challengeTypes = Object.keys(engine.getAllChallengeMetadata());

    const [perChallengeResults, globalScoring] = await Promise.all([
      Promise.all(
        challengeTypes.map(async (type) => {
          const { total } = await engine.getChallengesByType(type, { status: "ended", limit: 1 });
          return [type, { gamesPlayed: total }] as const;
        })
      ),
      engine.scoring ? engine.scoring.getGlobalScoring() : Promise.resolve([]),
    ]);

    return c.json({
      challenges: Object.fromEntries(perChallengeResults),
      global: {
        participants: globalScoring.length,
        gamesPlayed: perChallengeResults.reduce((sum, [, s]) => sum + s.gamesPlayed, 0),
      },
    });
  });

  return app;
}
