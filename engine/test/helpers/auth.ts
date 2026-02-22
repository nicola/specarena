import crypto from "node:crypto";

export interface TestKeypair {
  publicKeyHex: string;
  privateKey: crypto.KeyObject;
}

export function generateTestKeypair(): TestKeypair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const der = publicKey.export({ type: "spki", format: "der" }) as Buffer;
  // Raw Ed25519 public key is the last 32 bytes of the DER encoding
  const publicKeyHex = der.subarray(-32).toString("hex");
  return { publicKeyHex, privateKey };
}

export function signJoin(privateKey: crypto.KeyObject, invite: string): string {
  const message = `arena:v1:join:${invite}`;
  return crypto.sign(null, Buffer.from(message), privateKey).toString("hex");
}

