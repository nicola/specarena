import { Context, Next } from "hono";
import { ArenaEngine } from "@arena/engine/engine";
import { fromChallengeChannel } from "@arena/engine/types";
import { AuthEngine } from "./AuthEngine";

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice(7);
}

async function getChallengeIdFromRequest(c: Context): Promise<string | null> {
  // GET -- it will be in query
  let challengeId = c.req.query("channel")
    ?? c.req.query("challengeId");

  // POST -- it will be in body
  if (!challengeId) {
    const cloned = c.req.raw.clone();
    try {
      const body = await cloned.json();
      challengeId = body.challengeId || body.channel;
    } catch {
      // Expected for GET requests or non-JSON bodies; fall through to URL param check
    }
  }

  // URL param for SSE routes like /api/chat/ws/:uuid
  if (!challengeId) {
    const uuid = c.req.param("uuid");
    if (uuid) {
      challengeId = uuid;
    }
  }

  // Fallback for wildcard middleware where route params may not be resolved yet
  if (!challengeId) {
    const path = new URL(c.req.url).pathname;
    const match = path.match(/^\/api(?:\/v1)?\/chat\/ws\/([^/?#]+)/);
    if (match) {
      challengeId = decodeURIComponent(match[1]);
    }
  }

  if (!challengeId) {
    return null;
  }

  challengeId = fromChallengeChannel(challengeId) ?? challengeId;
  return challengeId;
}

export function createAuthUser(engine: ArenaEngine, auth: AuthEngine) {
  return async (c: Context, next: Next) => {
    const key = extractBearerToken(c.req.header("Authorization"))
      ?? c.req.query("key");
    const challengeId = await getChallengeIdFromRequest(c);

    if (!key) {
      c.set("identity", "viewer");
      return next();
    }

    if (!challengeId) {
      c.set("identity", "viewer");
      return next();
    }

    const validation = auth.validateSessionKey(key, challengeId);
    if (!validation.valid) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const identity = await engine.resolvePlayerIdentity(challengeId, validation.userIndex);
    c.set("identity", identity ?? "viewer");
    return next();
  };
}
