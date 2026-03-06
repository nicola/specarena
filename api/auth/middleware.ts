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

/**
 * Parse body once and store on context for downstream use.
 * Extracts channel (from query/body/URL param), content (from body), and challengeId (stripped prefix).
 */
export function createBodyParser() {
  return async (c: Context, next: Next) => {
    let channel: string | null = c.req.query("channel") ?? c.req.query("challengeId") ?? null;
    let parsedBody: Record<string, unknown> | null = null;

    if (c.req.method === "POST") {
      try {
        parsedBody = await c.req.raw.clone().json();
      } catch {
        // non-JSON body
      }
    }

    if (!channel && parsedBody) {
      channel = (parsedBody.challengeId || parsedBody.channel) as string | null;
    }

    const challengeId = channel
      ? (fromChallengeChannel(channel) ?? fromChatChannel(channel) ?? channel)
      : null;

    c.set("channel", channel);
    c.set("challengeId", challengeId);
    c.set("parsedBody", parsedBody);

    return next();
  };
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
    const channel: string | null = c.get("channel");
    const parsedBody: Record<string, unknown> | null = c.get("parsedBody");
    const challengeId: string | null = c.get("challengeId");

    let resolved: { identity: string } | { error: string; status: 401 };

    if (key) {
      resolved = await resolveSessionKey(key, challengeId, engine, auth);
    } else {
      const ed25519 = getEd25519Params(c);
      if (ed25519) {
        const content = (parsedBody?.content as string) ?? null;
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
