import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../../engine";

export function createChallengeRoutes(engine: ArenaEngine = defaultEngine) {
  const app = new Hono();

  // GET /api/metadata - all challenge metadata
  app.get("/api/metadata", (c) => {
    return c.json(engine.getAllChallengeMetadata());
  });

  // GET /api/metadata/:name - single challenge metadata
  app.get("/api/metadata/:name", (c) => {
    const name = c.req.param("name");
    const metadata = engine.getChallengeMetadata(name);
    if (!metadata) {
      return c.json({ error: "Challenge not found" }, 404);
    }
    return c.json(metadata);
  });

  // GET /api/challenges - list all challenges
  app.get("/api/challenges", async (c) => {
    const challengesList = await engine.listChallenges();
    return c.json({ challenges: challengesList, count: challengesList.length });
  });

  // GET /api/challenges/:name - list by type
  app.get("/api/challenges/:name", async (c) => {
    const name = c.req.param("name");
    try {
      const challengesList = await engine.getChallengesByType(name);
      return c.json({ challenges: challengesList, count: challengesList.length });
    } catch (error) {
      console.error("Error fetching challenges:", error);
      return c.json({ error: "Failed to fetch challenges" }, 500);
    }
  });

  // POST /api/challenges/:name - create challenge
  app.post("/api/challenges/:name", async (c) => {
    const name = c.req.param("name");
    const result = await engine.createChallenge(name);
    if (!result.success) {
      return c.json({ error: result.message }, 400);
    }
    return c.json(result.data);
  });

  return app;
}

export default createChallengeRoutes();
