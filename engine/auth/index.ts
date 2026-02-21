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

  verifyChatSignature(publicKey: string, channel: string, content: string, signature: string): boolean {
    if (!isValidHex(publicKey, 32) || !isValidHex(signature, 64)) {
      return false;
    }
    const message = `arena:v1:chat:${channel}:${content}`;
    return verifyEd25519Signature(publicKey, message, signature);
  }

}

/**
 * Hono middleware that verifies session tokens on protected routes.
 * Skips verification for the "invites" channel.
 * On success, sets `authInvite` on the Hono context (the resolved invite code).
 */
export function sessionAuth(resolveSession: (token: string, challengeId: string) => Promise<string | null>) {
  return async (c: Context, next: Next) => {
    // Extract Bearer token
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    // Determine challengeId and channel based on request method
    let challengeId: string | undefined;
    let channel: string | undefined;
    let bodyFrom: string | undefined;

    if (c.req.method === "GET") {
      channel = c.req.query("channel");
      challengeId = channel;
      bodyFrom = c.req.query("from");
    } else {
      const body = await c.req.json();
      challengeId = body.challengeId ?? body.channel;
      channel = body.channel ?? body.challengeId;
      bodyFrom = body.from;
    }

    // Skip auth for invites channel
    if (channel === "invites") {
      return next();
    }

    if (!token || !challengeId) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const invite = await resolveSession(token, challengeId);
    if (!invite) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // If `from` was provided, validate consistency
    if (bodyFrom && bodyFrom !== invite) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    // Set the authenticated invite on context for downstream handlers
    c.set("authInvite", invite);

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
