import crypto from "node:crypto";

// Ed25519 DER SPKI prefix (for wrapping raw 32-byte public keys)
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function isValidHex(str: string, expectedBytes?: number): boolean {
  if (typeof str !== "string") return false;
  if (str.length === 0) return false;
  if (str.length % 2 !== 0) return false;
  if (!/^[0-9a-f]+$/i.test(str)) return false;
  if (expectedBytes !== undefined && str.length !== expectedBytes * 2) return false;
  return true;
}

export function verifyEd25519Signature(
  publicKeyHex: string,
  message: string,
  signatureHex: string,
): boolean {
  if (!isValidHex(publicKeyHex, 32) || !isValidHex(signatureHex, 64)) {
    return false;
  }

  try {
    const keyObject = crypto.createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKeyHex, "hex")]),
      format: "der",
      type: "spki",
    });
    return crypto.verify(null, Buffer.from(message), keyObject, Buffer.from(signatureHex, "hex"));
  } catch {
    return false;
  }
}

/**
 * Create a session token: `s_<playerIndex>.<hmac_hex>`
 * HMAC input: `arena:v1:session:<challengeId>:<playerIndex>`
 */
export function createSessionToken(secret: string, challengeId: string, playerIndex: number): string {
  const hmac = crypto.createHmac("sha256", secret)
    .update(`arena:v1:session:${challengeId}:${playerIndex}`)
    .digest("hex");
  return `s_${playerIndex}.${hmac}`;
}

/**
 * Parse and verify a session token. Returns the playerIndex on success, null on failure.
 */
export function parseSessionToken(token: string, secret: string, challengeId: string): number | null {
  if (!token.startsWith("s_")) return null;
  const inner = token.slice(2); // strip "s_"
  const dotIdx = inner.indexOf(".");
  if (dotIdx < 0) return null;

  const indexStr = inner.slice(0, dotIdx);
  const hmac = inner.slice(dotIdx + 1);

  const playerIndex = parseInt(indexStr, 10);
  if (isNaN(playerIndex) || playerIndex < 0) return null;
  if (!isValidHex(hmac, 32)) return null;

  const expected = crypto.createHmac("sha256", secret)
    .update(`arena:v1:session:${challengeId}:${playerIndex}`)
    .digest("hex");

  if (hmac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expected))) return null;

  return playerIndex;
}

export function generateServerSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}
