import crypto from "node:crypto";

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

/**
 * Generate a random 32-byte hex secret for HMAC session keys.
 */
export function generateSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Derive a userId from an Ed25519 public key by hashing with SHA-256.
 */
export function hashPublicKey(publicKeyHex: string): string {
  return crypto.createHash("sha256").update(publicKeyHex).digest("hex");
}

export function parseSessionKey(key: string): { userIndex: number; expiresAt: number; hmac: string } | null {
  // Session key format: s_<userIndex>.<expiresAtMs>.<hmac>

  if (!key || !key.startsWith("s_")) {
    return null;
  }

  const [_s, session] = key.split("_");
  const [userIndexStr, expiresAtStr, hmac] = session.split(".");
  const userIndex = parseInt(userIndexStr, 10);
  const expiresAt = parseInt(expiresAtStr, 10);

  if (isNaN(userIndex)) {
    return null;
  }
  if (isNaN(expiresAt) || expiresAt <= 0) {
    return null;
  }
  if (!hmac || !/^[a-f0-9]{64}$/.test(hmac)) {
    return null;
  }
  return { userIndex, expiresAt, hmac };
}
