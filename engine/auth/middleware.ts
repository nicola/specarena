import type { Context, Next } from "hono";
import type { ArenaEngine } from "../engine";
import { validateSessionKey, parseSessionKey } from "../auth";

export interface SessionUser {
  userIndex: number;
  invite: string;
  challengeId: string;
}

/**
 * Creates a Hono middleware that validates session keys.
 * - POST routes: key required → 401 if missing/invalid, 403 if game ended
 * - GET routes: key optional → proceeds without auth if absent, 401 if present but invalid
 */
export function createSessionAuthMiddleware(engine: ArenaEngine) {
  return async (c: Context, next: Next) => {
    const isWrite = c.req.method === "POST";

    // Extract key: Bearer header for all routes, query param only for GET (SSE fallback)
    const key = extractBearerToken(c.req.header("Authorization"))
      ?? (!isWrite ? c.req.query("key") : undefined);

    if (!key) {
      if (isWrite) {
        return c.json({ error: "Authentication required" }, 401);
      }
      // GET without key → proceed without auth (existing behavior)
      return next();
    }

    // Parse key to get userIndex
    const parsed = parseSessionKey(key);
    if (!parsed) {
      return c.json({ error: "Invalid session key" }, 401);
    }

    // Determine challengeId from request
    let challengeId: string | undefined;

    if (isWrite) {
      // Clone the request to read body without consuming it
      const cloned = c.req.raw.clone();
      try {
        const body = await cloned.json();
        challengeId = body.challengeId || body.channel;
      } catch {
        // Body might not be JSON; let handler deal with it
      }
    } else {
      challengeId = c.req.query("channel");
    }

    if (challengeId) {
      // Try stripping challenge_ prefix if the raw value doesn't validate
      challengeId = deriveChallengeId(challengeId);
    }

    if (!challengeId) {
      return c.json({ error: "Cannot determine challenge for auth" }, 401);
    }

    // Validate HMAC
    const validation = validateSessionKey(engine.secret, key, challengeId);
    if (!validation.valid) {
      return c.json({ error: "Invalid session key" }, 401);
    }

    // Look up challenge to get invite code
    const challenge = await engine.getChallenge(challengeId);
    if (!challenge) {
      return c.json({ error: "Challenge not found" }, 401);
    }

    const invite = challenge.instance.state.players[validation.userIndex];
    if (!invite) {
      return c.json({ error: "Invalid session key" }, 401);
    }

    // For writes: check game hasn't ended
    if (isWrite && challenge.instance.state.gameEnded) {
      return c.json({ error: "Game has ended, key is no longer valid for writes" }, 403);
    }

    // Set session user in context
    c.set("sessionUser", {
      userIndex: validation.userIndex,
      invite,
      challengeId,
    } satisfies SessionUser);

    return next();
  };
}

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice(7);
}

function deriveChallengeId(value: string): string {
  if (value.startsWith("challenge_")) {
    return value.slice("challenge_".length);
  }
  return value;
}
