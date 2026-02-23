import { Context, Next } from "hono";
import { ArenaEngine } from "@arena/engine/engine";
import { AuthEngine } from "./AuthEngine";
import { parseSessionKey } from "./utils";

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
    }
  }

  // URL param for SSE routes like /api/chat/ws/:uuid
  if (!challengeId) {
    const uuid = c.req.param("uuid");
    if (uuid) {
      challengeId = uuid;
    }
  }

  if (!challengeId) {
    return null;
  }

  challengeId = deriveChallengeId(challengeId);
  return challengeId;
}

export function createStrictAuth(engine: ArenaEngine, auth: AuthEngine) {
  return async (c: Context, next: Next) => {
    const key = extractBearerToken(c.req.header("Authorization"))
      ?? c.req.query("key");
    const challengeId = await getChallengeIdFromRequest(c);

    if (!key || !challengeId) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const validation = auth.validateSessionKey(key, challengeId);
    if (!validation.valid) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const identity = await engine.resolvePlayerIdentity(challengeId, validation.userIndex);
    if (identity) {
      c.set("identity", identity);
    }

    return next();
  };
}
