import crypto from "node:crypto";

/**
 * Generate a random 32-byte hex secret for HMAC session keys.
 */
export function generateSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Create a session key: `s_<userIndex><HMAC-SHA256(secret, challengeId:userIndex)>`
 * Total: 67 chars — "s_" + 1 digit + 64 hex chars.
 */
export function createSessionKey(secret: string, challengeId: string, userIndex: number): string {
  if (!Number.isInteger(userIndex) || userIndex < 0 || userIndex > 9) {
    throw new RangeError(`userIndex must be 0-9, got ${userIndex}`);
  }
  const hmac = crypto.createHmac("sha256", secret)
    .update(`${challengeId}:${userIndex}`)
    .digest("hex");
  return `s_${userIndex}${hmac}`;
}

/**
 * Parse a session key into its components.
 * Returns null if the format is invalid.
 */
export function parseSessionKey(key: string): { userIndex: number; hmac: string } | null {
  if (!key || !key.startsWith("s_") || key.length !== 67) {
    return null;
  }
  const userIndex = parseInt(key[2], 10);
  if (isNaN(userIndex)) {
    return null;
  }
  const hmac = key.slice(3);
  if (!/^[a-f0-9]{64}$/.test(hmac)) {
    return null;
  }
  return { userIndex, hmac };
}

/**
 * Validate a session key by recomputing the HMAC and doing a timing-safe comparison.
 */
export function validateSessionKey(secret: string, key: string, challengeId: string): { valid: true; userIndex: number } | { valid: false } {
  const parsed = parseSessionKey(key);
  if (!parsed) {
    return { valid: false };
  }
  const expected = crypto.createHmac("sha256", secret)
    .update(`${challengeId}:${parsed.userIndex}`)
    .digest("hex");
  const a = Buffer.from(parsed.hmac, "hex");
  const b = Buffer.from(expected, "hex");
  if (!crypto.timingSafeEqual(a, b)) {
    return { valid: false };
  }
  return { valid: true, userIndex: parsed.userIndex };
}

/**
 * Verify an Ed25519 signature using Node.js crypto.
 */
export function verifySignature(publicKeyHex: string, signatureHex: string, message: string): boolean {
  try {
    const publicKeyBuffer = Buffer.from(publicKeyHex, "hex");
    const publicKey = crypto.createPublicKey({
      key: publicKeyBuffer,
      format: "der",
      type: "spki",
    });
    const signature = Buffer.from(signatureHex, "hex");
    return crypto.verify(null, Buffer.from(message), publicKey, signature);
  } catch {
    return false;
  }
}

/**
 * Generate an Ed25519 key pair. Returns hex-encoded DER keys.
 */
export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const pubDer = publicKey.export({ format: "der", type: "spki" });
  const privDer = privateKey.export({ format: "der", type: "pkcs8" });
  return {
    publicKey: Buffer.from(pubDer).toString("hex"),
    privateKey: Buffer.from(privDer).toString("hex"),
  };
}

/**
 * Sign a message with an Ed25519 private key (hex-encoded DER).
 */
export function sign(privateKeyHex: string, message: string): string {
  const privateKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyHex, "hex"),
    format: "der",
    type: "pkcs8",
  });
  return crypto.sign(null, Buffer.from(message), privateKey).toString("hex");
}

const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Verify a join request: checks timestamp freshness and Ed25519 signature.
 * Message format: `challengeId:invite:timestamp`
 */
export function verifyJoinRequest(
  publicKeyHex: string,
  signatureHex: string,
  challengeId: string,
  invite: string,
  timestamp: number,
): { valid: true } | { valid: false; reason: string } {
  const now = Date.now();
  if (Math.abs(now - timestamp) > TIMESTAMP_WINDOW_MS) {
    return { valid: false, reason: "Timestamp expired" };
  }
  const message = `${challengeId}:${invite}:${timestamp}`;
  if (!verifySignature(publicKeyHex, signatureHex, message)) {
    return { valid: false, reason: "Invalid signature" };
  }
  return { valid: true };
}
