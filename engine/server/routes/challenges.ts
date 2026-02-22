import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../../engine";
import type { Challenge } from "../../types";

// Simple in-memory rate limiter for challenge creation
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = 100; // max challenges per window per IP

/** Strip sensitive fields (invites, publicKeys, instance) from a challenge for public listing. */
function sanitizeChallenge(challenge: Challenge) {
  return {
    id: challenge.id,
    name: challenge.name,
    createdAt: challenge.createdAt,
    challengeType: challenge.challengeType,
    players: challenge.instance?.state?.players?.length ?? 0,
    gameStarted: challenge.instance?.state?.gameStarted ?? false,
    gameEnded: challenge.instance?.state?.gameEnded ?? false,
  };
}

export function createChallengeRoutes(engine: ArenaEngine = defaultEngine) {
  const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

  function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now >= entry.resetAt) {
      rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
      return true;
    }
    if (entry.count >= RATE_LIMIT_MAX) {
      return false;
    }
    entry.count++;
    return true;
  }
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

  // GET /api/challenges - list all challenges (sanitized — no invites/keys/state)
  app.get("/api/challenges", async (c) => {
    const challengesList = await engine.listChallenges();
    const sanitized = challengesList.map(sanitizeChallenge);
    return c.json({ challenges: sanitized, count: sanitized.length });
  });

  // GET /api/challenges/:name - list by type (sanitized)
  app.get("/api/challenges/:name", async (c) => {
    const name = c.req.param("name");
    try {
      const challengesList = await engine.getChallengesByType(name);
      const sanitized = challengesList.map(sanitizeChallenge);
      return c.json({ challenges: sanitized, count: sanitized.length });
    } catch (error) {
      console.error("Error fetching challenges:", error);
      return c.json({ error: "Failed to fetch challenges" }, 500);
    }
  });

  // POST /api/challenges/:name - create challenge (rate limited)
  app.post("/api/challenges/:name", async (c) => {
    const ip = c.req.header("x-forwarded-for") || c.req.header("x-real-ip") || "unknown";
    if (!checkRateLimit(ip)) {
      return c.json({ error: "Rate limit exceeded. Try again later." }, 429);
    }

    const name = c.req.param("name");
    try {
      const challenge = await engine.createChallenge(name);
      // Return full challenge (including invites) only to the creator
      return c.json(challenge);
    } catch (error) {
      console.error("Error creating challenge:", error);
      return c.json({ error: "Failed to create challenge" }, 500);
    }
  });

  return app;
}

export default createChallengeRoutes();
