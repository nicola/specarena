import { generateKeyPairSync, sign } from "node:crypto";
import bs58 from "bs58";
import { buildJoinProofPayload } from "../auth/AuthManager";

export interface DidKeyIdentity {
  did: string;
  signJoinProof(input: {
    domain: string;
    invite: string;
    nonce: string;
    nonceId: string;
    timestamp: number;
  }): string;
}

function deriveDidKeyFromPublicKeyDer(publicKeyDer: Buffer): string {
  const rawPublicKey = publicKeyDer.slice(-32);
  const multicodec = new Uint8Array(34);
  multicodec[0] = 0xed;
  multicodec[1] = 0x01;
  multicodec.set(rawPublicKey, 2);
  return `did:key:z${bs58.encode(Buffer.from(multicodec))}`;
}

export function createDidKeyIdentity(): DidKeyIdentity {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const publicKeyDer = publicKey.export({ type: "spki", format: "der" }) as Buffer;
  const did = deriveDidKeyFromPublicKeyDer(publicKeyDer);

  return {
    did,
    signJoinProof(input) {
      const payload = buildJoinProofPayload({
        domain: input.domain,
        invite: input.invite,
        nonce: input.nonce,
        nonceId: input.nonceId,
        timestamp: input.timestamp,
        did,
      });
      return sign(null, Buffer.from(payload, "utf-8"), privateKey).toString("base64url");
    },
  };
}

export interface JoinAuthBundle {
  accessToken: string;
  did: string;
  invite: string;
  challengeId: string;
}

interface JoinNonceResponse {
  nonceId: string;
  nonce: string;
  domain: string;
  expiresAt: number;
  proofRequired: boolean;
}

export async function joinWithDidProof(options: {
  request: (method: string, path: string, body?: object, headers?: Record<string, string>) => Promise<Response>;
  invite: string;
  identity?: DidKeyIdentity;
}): Promise<{ challengeId: string; auth: JoinAuthBundle }> {
  const nonceRes = await options.request("POST", "/api/auth/nonce", {
    purpose: "join",
    invite: options.invite,
  });
  if (!nonceRes.ok) {
    throw new Error(`Failed to fetch nonce: ${nonceRes.status}`);
  }
  const nonceBody = await nonceRes.json() as JoinNonceResponse;

  const identity = options.identity ?? createDidKeyIdentity();
  const timestamp = Date.now();
  const signature = identity.signJoinProof({
    domain: nonceBody.domain,
    invite: options.invite,
    nonce: nonceBody.nonce,
    nonceId: nonceBody.nonceId,
    timestamp,
  });

  const joinRes = await options.request("POST", "/api/arena/join", {
    invite: options.invite,
    did: identity.did,
    nonceId: nonceBody.nonceId,
    signature,
    timestamp,
  });
  if (!joinRes.ok) {
    const text = await joinRes.text();
    throw new Error(`Join failed (${joinRes.status}): ${text}`);
  }
  const joinBody = await joinRes.json() as {
    ChallengeID: string;
    auth: JoinAuthBundle;
  };
  return {
    challengeId: joinBody.ChallengeID,
    auth: joinBody.auth,
  };
}
