import { parseSessionKey, verifySignature } from "./utils";
import crypto from "node:crypto";

const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000;

export class AuthEngine {
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = secret;
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
    const message = `arena:v1:join:${invite}:${timestamp}`;
    if (!verifySignature(publicKeyHex, signatureHex, message)) {
      return { valid: false, reason: "Invalid signature" };
    }
    return { valid: true };
  }

  /**
   * Create a session key: `s_<userIndex>.<HMAC-SHA256(secret, challengeId:userIndex)>`
   */
  createSessionKey(challengeId: string, userIndex: number): string {
    const hmac = crypto.createHmac("sha256", this.secret)
      .update(`arena:v1:session:${challengeId}:${userIndex}`)
      .digest("hex");
    return `s_${userIndex}.${hmac}`;
  }

  /**
   * Validate a session key by recomputing the HMAC and doing a timing-safe comparison.
   */
  validateSessionKey(key: string, challengeId: string): { valid: true; userIndex: number } | { valid: false } {
    const parsed = parseSessionKey(key);
    if (!parsed) {
      return { valid: false };
    }

    const expected = crypto.createHmac("sha256", this.secret)
      .update(`arena:v1:session:${challengeId}:${parsed.userIndex}`)
      .digest("hex");
    const a = Buffer.from(parsed.hmac, "hex");
    const b = Buffer.from(expected, "hex");
    if (!crypto.timingSafeEqual(a, b)) {
      return { valid: false };
    }
    return { valid: true, userIndex: parsed.userIndex };
  }
}