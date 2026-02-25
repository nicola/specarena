import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../../engine";
import { Challenge, ChallengeListItem, CreateChallengeResponse } from "../../types";

function toChallengeListItem(engine: ArenaEngine, challenge: Challenge): ChallengeListItem {
  const metadata = engine.getChallengeMetadata(challenge.challengeType);
  const expectedPlayers = metadata?.players ?? challenge.invites.length;
  const state = challenge.instance.state;

  return {
    id: challenge.id,
    name: challenge.name,
    createdAt: challenge.createdAt,
    challengeType: challenge.challengeType,
    state: {
      gameStarted: state.gameStarted,
      gameEnded: state.gameEnded,
      expectedPlayers,
      joinedPlayers: state.players.length,
      playerIdentities: state.gameEnded ? state.playerIdentities : undefined,
    },
  };
}

function toCreateChallengeResponse(challenge: Challenge): CreateChallengeResponse {
  return {
    id: challenge.id,
    name: challenge.name,
    createdAt: challenge.createdAt,
    challengeType: challenge.challengeType,
    invites: challenge.invites,
  };
}

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
    const challengesList = (await engine.listChallenges())
      .map((challenge) => toChallengeListItem(engine, challenge));
    return c.json({ challenges: challengesList, count: challengesList.length });
  });

  // GET /api/challenges/:name - list by type
  app.get("/api/challenges/:name", async (c) => {
    const name = c.req.param("name");
    try {
      const challengesList = (await engine.getChallengesByType(name))
        .map((challenge) => toChallengeListItem(engine, challenge));
      return c.json({ challenges: challengesList, count: challengesList.length });
    } catch (error) {
      console.error("Error fetching challenges:", error);
      return c.json({ error: "Failed to fetch challenges" }, 500);
    }
  });

  // POST /api/challenges/:name - create challenge
  app.post("/api/challenges/:name", async (c) => {
    const name = c.req.param("name");
    try {
      const challenge = await engine.createChallenge(name);
      return c.json(toCreateChallengeResponse(challenge));
    } catch (error) {
      console.error("Error creating challenge:", error);
      return c.json({ error: "Failed to create challenge" }, 500);
    }
  });

  return app;
}

export default createChallengeRoutes();
