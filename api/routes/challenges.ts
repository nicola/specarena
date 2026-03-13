import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "@arena/engine/engine";
import { sanitizeChallenge, ChallengeStatus, type Challenge } from "@arena/engine/types";
import type { UserProfile } from "@arena/engine/users";

/** Collect all user profiles referenced in playerIdentities across challenges. */
export async function collectUserProfiles(
  engine: ArenaEngine,
  challenges: Challenge[],
): Promise<Record<string, UserProfile>> {
  const userIds = new Set<string>();
  for (const c of challenges) {
    if (c.state?.playerIdentities) {
      for (const userId of Object.values(c.state.playerIdentities)) {
        userIds.add(userId);
      }
    }
  }
  if (userIds.size === 0) return {};
  return engine.users.getUsers([...userIds]);
}

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;

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
    const limit = Math.min(Math.max(1, parseInt(c.req.query("limit") || String(DEFAULT_PAGE_LIMIT), 10) || DEFAULT_PAGE_LIMIT), MAX_PAGE_LIMIT);
    const offset = Math.max(0, parseInt(c.req.query("offset") || "0", 10) || 0);
    const statusParam = c.req.query("status");
    const status = (Object.values(ChallengeStatus) as string[]).includes(statusParam ?? "")
      ? (statusParam as ChallengeStatus)
      : undefined;
    const { items, total } = await engine.listChallenges({ limit, offset, status });
    const profiles = await collectUserProfiles(engine, items);
    return c.json({ challenges: items.map(sanitizeChallenge), total, limit, offset, profiles });
  });

  // GET /api/challenges/:name - list by type
  app.get("/api/challenges/:name", async (c) => {
    const name = c.req.param("name");
    try {
      const limit = Math.min(Math.max(1, parseInt(c.req.query("limit") || String(DEFAULT_PAGE_LIMIT), 10) || DEFAULT_PAGE_LIMIT), MAX_PAGE_LIMIT);
      const offset = Math.max(0, parseInt(c.req.query("offset") || "0", 10) || 0);
      const statusParam = c.req.query("status");
      const status = (Object.values(ChallengeStatus) as string[]).includes(statusParam ?? "")
        ? (statusParam as ChallengeStatus)
        : undefined;
      const { items, total } = await engine.getChallengesByType(name, { limit, offset, status });
      const profiles = await collectUserProfiles(engine, items);
      return c.json({ challenges: items.map(sanitizeChallenge), total, limit, offset, profiles });
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
      return c.json(challenge);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create challenge";
      if (message.startsWith("Unknown challenge type")) {
        return c.json({ error: message }, 400);
      }
      console.error("Error creating challenge:", error);
      return c.json({ error: "Failed to create challenge" }, 500);
    }
  });

  return app;
}

export default createChallengeRoutes();
