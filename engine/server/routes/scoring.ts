import { Hono } from "hono";
import type { ArenaEngine } from "../../engine";

export function createScoringRoutes(engine: ArenaEngine): Hono {
  const app = new Hono();

  // GET /api/scoring — global scoring
  app.get("/api/scoring", async (c) => {
    if (!engine.scoring) {
      return c.json({ error: "Scoring not configured" }, 404);
    }
    return c.json(await engine.scoring.getGlobalScoring());
  });

  // GET /api/scoring/:challengeType — per-challenge scoring (all strategies)
  app.get("/api/scoring/:challengeType", async (c) => {
    if (!engine.scoring) {
      return c.json({ error: "Scoring not configured" }, 404);
    }
    const challengeType = c.req.param("challengeType");
    if (!engine.getChallengeMetadata(challengeType)) {
      return c.json({ error: "Unknown challenge type" }, 404);
    }
    return c.json(await engine.scoring.getScoring(challengeType));
  });

  return app;
}
