import type { Context, Next } from "hono";
import {
  verifyEd25519Signature,
  createSessionToken,
  verifySessionToken,
  generateServerSecret,
  isValidHex,
} from "./crypto";

export class AuthEngine {
  private readonly secret: string;
  // challengeId → invite → publicKey
  private readonly publicKeys: Map<string, Map<string, string>>;

  constructor(secret?: string) {
    this.secret = secret ?? generateServerSecret();
    this.publicKeys = new Map();
  }

  authenticateJoin(
    challengeId: string,
    invite: string,
    publicKey: string,
    signature: string,
  ): { sessionToken: string } | { error: string } {
    if (!isValidHex(publicKey, 32)) {
      return { error: "Invalid public key" };
    }
    if (!isValidHex(signature, 64)) {
      return { error: "Invalid signature" };
    }

    const message = `arena:join:${invite}`;
    if (!verifyEd25519Signature(publicKey, message, signature)) {
      return { error: "Signature verification failed" };
    }

    // Store public key
    if (!this.publicKeys.has(challengeId)) {
      this.publicKeys.set(challengeId, new Map());
    }
    this.publicKeys.get(challengeId)!.set(invite, publicKey);

    const sessionToken = createSessionToken(this.secret, challengeId, invite);
    return { sessionToken };
  }

  verifySession(token: string, challengeId: string, invite: string): boolean {
    return verifySessionToken(token, this.secret, challengeId, invite);
  }

  verifyChatSignature(publicKey: string, channel: string, content: string, signature: string): boolean {
    if (!isValidHex(publicKey, 32) || !isValidHex(signature, 64)) {
      return false;
    }
    const message = `arena:chat:${channel}:${content}`;
    return verifyEd25519Signature(publicKey, message, signature);
  }

  getPublicKey(challengeId: string, invite: string): string | undefined {
    return this.publicKeys.get(challengeId)?.get(invite);
  }

  getPublicKeys(challengeId: string): Map<string, string> | undefined {
    return this.publicKeys.get(challengeId);
  }

  clearRuntimeState(): void {
    this.publicKeys.clear();
  }
}

/**
 * Hono middleware that verifies session tokens on protected routes.
 * Skips verification for the "invites" channel.
 */
export function sessionAuth(auth: AuthEngine) {
  return async (c: Context, next: Next) => {
    // Extract Bearer token
    const authHeader = c.req.header("Authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined;

    // Determine challengeId and from based on request method
    let challengeId: string | undefined;
    let from: string | undefined;
    let channel: string | undefined;

    if (c.req.method === "GET") {
      channel = c.req.query("channel");
      from = c.req.query("from");
      challengeId = c.req.query("channel");
    } else {
      const body = await c.req.json();
      challengeId = body.challengeId ?? body.channel;
      channel = body.channel ?? body.challengeId;
      from = body.from;
    }

    // Skip auth for invites channel
    if (channel === "invites") {
      return next();
    }

    if (!token || !challengeId || !from) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    if (!auth.verifySession(token, challengeId, from)) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    return next();
  };
}

export {
  verifyEd25519Signature,
  createSessionToken,
  verifySessionToken,
  generateServerSecret,
  isValidHex,
} from "./crypto";
