import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../../engine";
import { errorResponse, internalRouteError } from "./errors";

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
      return errorResponse(c, 404, "CHALLENGE_NOT_FOUND", "Challenge not found");
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
      return internalRouteError(c, "GET /api/challenges/:name", error, "CHALLENGES_FETCH_FAILED", "Failed to fetch challenges");
    }
  });

  // POST /api/challenges/:name - create challenge
  app.post("/api/challenges/:name", async (c) => {
    const name = c.req.param("name");
    try {
      const challenge = await engine.createChallenge(name);
      return c.json(challenge);
    } catch (error) {
      return internalRouteError(c, "POST /api/challenges/:name", error, "CHALLENGE_CREATE_FAILED", "Failed to create challenge");
    }
  });

  return app;
}

export default createChallengeRoutes();
