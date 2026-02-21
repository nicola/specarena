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

export function createSessionToken(secret: string, challengeId: string, invite: string): string {
  return crypto.createHmac("sha256", secret).update(`${challengeId}:${invite}`).digest("hex");
}

export function verifySessionToken(
  token: string,
  secret: string,
  challengeId: string,
  invite: string,
): boolean {
  const expected = createSessionToken(secret, challengeId, invite);
  return token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

export function generateServerSecret(): string {
  return crypto.randomBytes(32).toString("hex");
}
