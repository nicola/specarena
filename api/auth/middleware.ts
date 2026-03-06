import { Context, Next } from "hono";
import crypto from "node:crypto";
import { ArenaEngine } from "@arena/engine/engine";
import { fromChallengeChannel, fromChatChannel } from "@arena/engine/types";
import { AuthEngine } from "./AuthEngine";
import { hashPublicKey } from "./utils";

function extractBearerToken(header: string | undefined): string | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice(7);
}

async function getRequestContext(c: Context): Promise<{ challengeId: string | null; channel: string | null; content: string | null }> {
  let channel: string | null = null;
  let content: string | null = null;

  // GET -- query params
  channel = c.req.query("channel")
    ?? c.req.query("challengeId")
    ?? null;

  // POST -- body
  if (!channel) {
    const cloned = c.req.raw.clone();
    try {
      const body = await cloned.json();
      channel = body.challengeId || body.channel || null;
      content = body.content ?? null;
    } catch {
      // Expected for GET requests or non-JSON bodies
    }
  } else if (c.req.method === "POST") {
    // Channel found in query, but we still need content from body
    const cloned = c.req.raw.clone();
    try {
      const body = await cloned.json();
      content = body.content ?? null;
    } catch {
      // non-JSON body
    }
  }

  // URL param for SSE routes like /api/chat/ws/:uuid
  if (!channel) {
    const uuid = c.req.param("uuid");
    if (uuid) {
      channel = uuid;
    }
  }

  // Strip channel prefixes to get bare challengeId
  const challengeId = channel
    ? (fromChallengeChannel(channel) ?? fromChatChannel(channel) ?? channel)
    : null;

  return { challengeId, channel, content };
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
    const { challengeId, channel, content } = await getRequestContext(c);

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
      const effectiveChannel = channel ?? "";
      let result;
      if (method === "GET") {
        result = auth.authenticateChannelRead(ed25519.publicKey, ed25519.signature, ed25519.timestamp, effectiveChannel);
      } else {
        const contentHash = crypto.createHash("sha256").update(content ?? "").digest("hex");
        result = auth.authenticateSend(ed25519.publicKey, ed25519.signature, ed25519.timestamp, effectiveChannel, contentHash);
      }

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
