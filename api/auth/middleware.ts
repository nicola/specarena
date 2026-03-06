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

  channel = c.req.query("channel")
    ?? c.req.query("challengeId")
    ?? null;

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
    const cloned = c.req.raw.clone();
    try {
      const body = await cloned.json();
      content = body.content ?? null;
    } catch {
      // non-JSON body
    }
  }

  if (!channel) {
    const uuid = c.req.param("uuid");
    if (uuid) channel = uuid;
  }

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
    if (!isNaN(timestamp)) return { publicKey, signature, timestamp };
  }

  return null;
}

async function resolveSessionKey(
  key: string,
  challengeId: string | null,
  engine: ArenaEngine,
  auth: AuthEngine,
): Promise<{ identity: string } | { error: string; status: 401 }> {
  if (!challengeId) return { identity: "viewer" };

  const validation = auth.validateSessionKey(key, challengeId);
  if (!validation.valid) return { error: "Authentication required", status: 401 };

  const identity = await engine.resolvePlayerIdentity(challengeId, validation.userIndex);
  return { identity: identity ?? "viewer" };
}

function resolveEd25519(
  params: { publicKey: string; signature: string; timestamp: number },
  method: string,
  channel: string | null,
  content: string | null,
  auth: AuthEngine,
): { identity: string } | { error: string; status: 401 } {
  const effectiveChannel = channel ?? "";
  const result = method === "GET"
    ? auth.authenticateChannelRead(params.publicKey, params.signature, params.timestamp, effectiveChannel)
    : auth.authenticateSend(
        params.publicKey, params.signature, params.timestamp, effectiveChannel,
        crypto.createHash("sha256").update(content ?? "").digest("hex"),
      );

  if (!result.valid) return { error: result.reason, status: 401 };
  return { identity: hashPublicKey(params.publicKey) };
}

export function createAuthUser(engine: ArenaEngine, auth: AuthEngine) {
  return async (c: Context, next: Next) => {
    const key = extractBearerToken(c.req.header("Authorization")) ?? c.req.query("key");
    const { challengeId, channel, content } = await getRequestContext(c);

    let resolved: { identity: string } | { error: string; status: 401 };

    if (key) {
      resolved = await resolveSessionKey(key, challengeId, engine, auth);
    } else {
      const ed25519 = getEd25519Params(c);
      if (ed25519) {
        resolved = resolveEd25519(ed25519, c.req.method, channel, content, auth);
      } else {
        resolved = { identity: "viewer" };
      }
    }

    if ("error" in resolved) return c.json({ error: resolved.error }, resolved.status);
    c.set("identity", resolved.identity);
    return next();
  };
}
