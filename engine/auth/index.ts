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
  // challengeId → playerIndex → invite
  private readonly invitesByIndex: Map<string, Map<number, string>>;

  constructor(secret?: string) {
    this.secret = secret ?? generateServerSecret();
    this.invitesByIndex = new Map();
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

    // Store index → invite mapping
    if (!this.invitesByIndex.has(challengeId)) {
      this.invitesByIndex.set(challengeId, new Map());
    }
    this.invitesByIndex.get(challengeId)!.set(playerIndex, invite);

    const sessionToken = createSessionToken(this.secret, challengeId, playerIndex);
    return { sessionToken };
  }

  /**
   * Resolve a session token to the player's invite code.
   * Returns the invite string on success, null on failure.
   */
  resolveSession(token: string, challengeId: string): string | null {
    const playerIndex = parseSessionToken(token, this.secret, challengeId);
    if (playerIndex === null) return null;
    return this.invitesByIndex.get(challengeId)?.get(playerIndex) ?? null;
  }

  verifyChatSignature(publicKey: string, channel: string, content: string, signature: string): boolean {
    if (!isValidHex(publicKey, 32) || !isValidHex(signature, 64)) {
      return false;
    }
    const message = `arena:v1:chat:${channel}:${content}`;
    return verifyEd25519Signature(publicKey, message, signature);
  }

  clearRuntimeState(): void {
    this.invitesByIndex.clear();
  }
}

/**
 * Hono middleware that verifies session tokens on protected routes.
 * Skips verification for the "invites" channel.
 * On success, sets `authInvite` on the Hono context (the resolved invite code).
 */
export function sessionAuth(auth: AuthEngine) {
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

    const invite = auth.resolveSession(token, challengeId);
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
