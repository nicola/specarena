import type { Context, Next } from "hono";
import {
  verifyEd25519Signature,
  createSessionToken,
  parseSessionToken,
  generateServerSecret,
  isValidHex,
} from "./crypto";

export class AuthEngine {
  private readonly secret: string;

  constructor(secret?: string) {
    this.secret = secret ?? generateServerSecret();
  }

  authenticateJoin(
    challengeId: string,
    invite: string,
    playerIndex: number,
    publicKey: string,
    signature: string,
  ): { sessionToken: string } | { error: string } {
    if (!isValidHex(publicKey, 32)) {
      return { error: "Invalid public key" };
    }
    if (!isValidHex(signature, 64)) {
      return { error: "Invalid signature" };
    }

    const message = `arena:v1:join:${invite}`;
    if (!verifyEd25519Signature(publicKey, message, signature)) {
      return { error: "Signature verification failed" };
    }

    const sessionToken = createSessionToken(this.secret, challengeId, playerIndex);
    return { sessionToken };
  }

  /**
   * Verify a session token and return the player index.
   * Returns the player index on success, null on failure.
   */
  verifyToken(token: string, challengeId: string): number | null {
    return parseSessionToken(token, this.secret, challengeId);
  }

}

export type ResolveSession = (token: string, challengeId: string) => Promise<string | null>;

/**
 * Hono middleware that verifies session tokens on protected routes.
 * On success, sets `authInvite` on the Hono context (the resolved invite code).
 */
export function sessionAuth(resolveSession: ResolveSession) {
  return async (c: Context, next: Next) => {
    // Extract Bearer token
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    // Determine challengeId based on request method
    let challengeId: string | undefined;

    if (c.req.method === "GET") {
      challengeId = c.req.query("channel");
    } else {
      const body = await c.req.json();
      challengeId = body.challengeId ?? body.channel;
    }

    if (!token || !challengeId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const invite = await resolveSession(token, challengeId);
    if (!invite) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Set the authenticated invite on context for downstream handlers
    c.set("authInvite", invite);

    return next();
  };
}

/**
 * Hono middleware that optionally resolves session identity but never 401s.
 * If token present and valid → sets `authInvite`. If absent/invalid → just calls next().
 */
export function optionalSessionAuth(resolveSession: ResolveSession) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    if (token) {
      let challengeId: string | undefined;
      if (c.req.method === "GET") {
        challengeId = c.req.query("channel");
      } else {
        const body = await c.req.json();
        challengeId = body.challengeId ?? body.channel;
      }

      if (challengeId) {
        const invite = await resolveSession(token, challengeId);
        if (invite) c.set("authInvite", invite);
      }
    }

    return next();
  };
}

export {
  verifyEd25519Signature,
  createSessionToken,
  parseSessionToken,
  generateServerSecret,
  isValidHex,
} from "./crypto";
