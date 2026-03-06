import { parseSessionKey, verifySignature } from "./utils";
import crypto from "node:crypto";

const PROTOCOL_VERSION = "arena:v1";
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
    const message = `${PROTOCOL_VERSION}:join:${invite}:${timestamp}`;
    if (!verifySignature(publicKeyHex, signatureHex, message)) {
      return { valid: false, reason: "Invalid signature" };
    }
    return { valid: true };
  }

  authenticateUserUpdate(
    publicKeyHex: string,
    signatureHex: string,
    timestamp: number,
  ): { valid: true } | { valid: false; reason: string } {
    const now = Date.now();
    if (Math.abs(now - timestamp) > TIMESTAMP_WINDOW_MS) {
      return { valid: false, reason: "Timestamp expired" };
    }
    const message = `${PROTOCOL_VERSION}:user-update:${timestamp}`;
    if (!verifySignature(publicKeyHex, signatureHex, message)) {
      return { valid: false, reason: "Invalid signature" };
    }
    return { valid: true };
  }

  authenticateSend(
    publicKeyHex: string,
    signatureHex: string,
    timestamp: number,
    channel: string,
    contentHash: string,
  ): { valid: true } | { valid: false; reason: string } {
    const now = Date.now();
    if (Math.abs(now - timestamp) > TIMESTAMP_WINDOW_MS) {
      return { valid: false, reason: "Timestamp expired" };
    }
    const message = `${PROTOCOL_VERSION}:send:${channel}:${contentHash}:${timestamp}`;
    if (!verifySignature(publicKeyHex, signatureHex, message)) {
      return { valid: false, reason: "Invalid signature" };
    }
    return { valid: true };
  }

  authenticateChannelRead(
    publicKeyHex: string,
    signatureHex: string,
    timestamp: number,
    channel: string,
  ): { valid: true } | { valid: false; reason: string } {
    const now = Date.now();
    if (Math.abs(now - timestamp) > TIMESTAMP_WINDOW_MS) {
      return { valid: false, reason: "Timestamp expired" };
    }
    const message = `${PROTOCOL_VERSION}:channel-read:${channel}:${timestamp}`;
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
      .update(`${PROTOCOL_VERSION}:session:${challengeId}:${userIndex}`)
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
      .update(`${PROTOCOL_VERSION}:session:${challengeId}:${parsed.userIndex}`)
      .digest("hex");
    const a = Buffer.from(parsed.hmac, "hex");
    const b = Buffer.from(expected, "hex");
    if (!crypto.timingSafeEqual(a, b)) {
      return { valid: false };
    }
    return { valid: true, userIndex: parsed.userIndex };
  }
}
