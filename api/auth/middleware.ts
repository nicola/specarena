import { Context, Next } from "hono";
import { ArenaEngine } from "@arena/engine/engine";
import { fromChallengeChannel, fromChatChannel } from "@arena/engine/types";
import { AuthEngine } from "./AuthEngine";
import { hashPublicKey } from "./utils";

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

  if (!challengeId) {
    return null;
  }

  // Strip channel prefixes to get bare challengeId
  challengeId = fromChallengeChannel(challengeId) ?? fromChatChannel(challengeId) ?? challengeId;
  return challengeId;
}

function getEd25519Params(c: Context): { publicKey: string; signature: string; timestamp: number } | null {
  const publicKey = c.req.query("publicKey");
  const signature = c.req.query("signature");
  const timestampStr = c.req.query("timestamp");

  if (publicKey && signature && timestampStr) {
    const timestamp = Number(timestampStr);
    if (!isNaN(timestamp)) {
      return { publicKey, signature, timestamp };
    }
  }

  return null;
}

export function createAuthUser(engine: ArenaEngine, auth: AuthEngine) {
  return async (c: Context, next: Next) => {
    const key = extractBearerToken(c.req.header("Authorization"))
      ?? c.req.query("key");
    const challengeId = await getChallengeIdFromRequest(c);

    // Session key auth (primary for challenge channels)
    if (key) {
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
    }

    // Ed25519 signature auth (for user channels, invites channel, etc.)
    const ed25519 = getEd25519Params(c);
    if (ed25519) {
      const method = c.req.method;
      const result = method === "GET"
        ? auth.authenticateChannelRead(ed25519.publicKey, ed25519.signature, ed25519.timestamp)
        : auth.authenticateSend(ed25519.publicKey, ed25519.signature, ed25519.timestamp);

      if (!result.valid) {
        return c.json({ error: result.reason }, 401);
      }

      const userId = hashPublicKey(ed25519.publicKey);
      c.set("identity", userId);
      return next();
    }

    c.set("identity", "viewer");
    return next();
  };
}
