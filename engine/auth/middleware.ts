import { Context, Next } from "hono";
import crypto from "node:crypto";
import { ArenaEngine } from "../engine";
import { Challenge } from "../types";
import { parseSessionKey } from "./utils";
import { AuthEngine } from "./AuthEngine"

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

export interface SessionUser {
  userIndex: number;
  challengeId: string;
}

export type AuthEnv = { Variables: { sessionUser?: SessionUser; identity?: string } };

export function getIdentity(c: Context, fallback?: string | null): string | null {
  return c.get("identity") ?? fallback ?? null;
}

export function requireSessionKey(c: Context, next: Next) {
  const sessionKey = c.get("sessionUser");
  if (!sessionKey) {
    return c.json({ error: "Authentication required" }, 401);
  }
  return next();
}

async function getUserFromSessionKey(key: string, challengeId: string, auth: AuthEngine): Promise<SessionUser | null> {
  // Extract key: Bearer header for all routes
  // query param only for GET (SSE fallback)

  // Parse key to get userIndex
  const parsed = parseSessionKey(key);
  if (!parsed) {
    return null;
  }

  // Validate HMAC
  const validation = auth.validateSessionKey(key, challengeId);
  if (!validation.valid) {
    return null;
  }

  return {
    userIndex: validation.userIndex,
    challengeId: challengeId,
  } satisfies SessionUser;
}


async function getChallengeIdFromRequest(c: Context): Promise<string | null> {
  // GET -- it will be in query
  let challengeId = c.req.query("channel")
    ?? c.req.query("challengeId")

  // POST -- it will be in body
  if (!challengeId) {
    const cloned = c.req.raw.clone();
    try {
      const body = await cloned.json();
      challengeId = body.challengeId || body.channel;
    } catch {
    }
  }

  // If still no challengeId, move on
  if (!challengeId) {
    return null;
  }

  // Try stripping challenge_ prefix if the raw value doesn't validate
  challengeId = deriveChallengeId(challengeId);

  return challengeId;
}

/**
 * Creates a Hono middleware that stores sessionUser in session if:
 * - key is present
 * - challengeId is present and valid
 */
export function createSessionAuth(engine: ArenaEngine) {
  return async (c: Context, next: Next) => {
    if (!engine.auth) {
      return next();
    }

    const key = extractBearerToken(c.req.header("Authorization"))
    ?? c.req.query("key");
    const challengeId = await getChallengeIdFromRequest(c);

    if (!key || !challengeId) {
      return next();
    }

    const sessionUser = await getUserFromSessionKey(key, challengeId, engine.auth);

    if (!sessionUser) {
      return next();
    }

    // Set session user in context
    c.set("sessionUser", sessionUser);

    // Resolve player identity
    const identity = await engine.resolvePlayerIdentity(sessionUser.challengeId, sessionUser.userIndex);
    if (identity) {
      c.set("identity", identity);
    }

    return next();
  };
}