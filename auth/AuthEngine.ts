import { parseSessionKey, verifySignature } from "./utils";
import crypto from "node:crypto";

const PROTOCOL_VERSION = "arena:v1";
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

export class AuthEngine {
  private readonly secret: string;
  private readonly sessionTtlMs: number;
  private readonly revokedSessionKeys: Set<string>;

  constructor(secret: string, options?: { sessionTtlMs?: number }) {
    this.secret = secret;
    this.sessionTtlMs = options?.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
    this.revokedSessionKeys = new Set<string>();
  }

  authenticateJoin(
    publicKeyHex: string,
    signatureHex: string,
    invite: string,
    timestamp: number,
  ): { valid: true } | { valid: false; reason: string } {
    const now = Date.now();
    if (Math.abs(now - timestamp) > TIMESTAMP_WINDOW_MS) {
      return { valid: false, reason: "Timestamp expired" };
    }
    const message = `${PROTOCOL_VERSION}:join:${invite}:${timestamp}`;
    if (!verifySignature(publicKeyHex, signatureHex, message)) {
      return { valid: false, reason: "Invalid signature" };
    }
    return { valid: true };
  }

  /**
   * Create a session key:
   * `s_<userIndex>.<expiresAtMs>.<HMAC-SHA256(secret, challengeId:userIndex:expiresAtMs)>`
   */
  createSessionKey(challengeId: string, userIndex: number, nowMs: number = Date.now()): string {
    const expiresAt = nowMs + this.sessionTtlMs;
    const hmac = crypto.createHmac("sha256", this.secret)
      .update(`${PROTOCOL_VERSION}:session:${challengeId}:${userIndex}:${expiresAt}`)
      .digest("hex");
    return `s_${userIndex}.${expiresAt}.${hmac}`;
  }

  revokeSessionKey(key: string): void {
    this.revokedSessionKeys.add(key);
  }

  /**
   * Validate a session key by recomputing the HMAC and doing a timing-safe comparison.
   */
  validateSessionKey(key: string, challengeId: string): { valid: true; userIndex: number } | { valid: false } {
    const parsed = parseSessionKey(key);
    if (!parsed) {
      return { valid: false };
    }
    if (parsed.expiresAt < Date.now()) {
      return { valid: false };
    }
    if (this.revokedSessionKeys.has(key)) {
      return { valid: false };
    }

    const expected = crypto.createHmac("sha256", this.secret)
      .update(`${PROTOCOL_VERSION}:session:${challengeId}:${parsed.userIndex}:${parsed.expiresAt}`)
      .digest("hex");
    const a = Buffer.from(parsed.hmac, "hex");
    const b = Buffer.from(expected, "hex");
    if (!crypto.timingSafeEqual(a, b)) {
      return { valid: false };
    }
    return { valid: true, userIndex: parsed.userIndex };
  }
}
