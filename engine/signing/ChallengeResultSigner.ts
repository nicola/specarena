import { createPrivateKey, createPublicKey, sign as cryptoSign, verify as cryptoVerify } from "node:crypto";
import { ChallengeResultSigner } from "../types";

const DEV_PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MC4CAQAwBQYDK2VwBCIEIM1Nv69OX83JDMZYBHDMNxibKfW0AMacjrODTA0RoqLr
-----END PRIVATE KEY-----`;

const DEV_PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAsUfIJP/zw1YS6qce9h/M3SZ1IUz2Bm7ZczyxoaWBJlw=
-----END PUBLIC KEY-----`;

const DEV_KEY_ID = "arena-dev-ed25519-v1";
export const ARENA_CANONICALIZATION_ID = "arena-json-sort-v1";
export const ARENA_CANONICALIZATION_DESCRIPTION =
  "Recursively sort object keys lexicographically and serialize with JSON.stringify.";
export const ARENA_ATTESTATION_SIGNATURE_FORMAT = "arena.challenge_result.v1-envelope";

export interface Ed25519ChallengeResultSignerConfig {
  privateKeyPem: string;
  publicKeyPem: string;
  keyId: string;
}

export interface ChallengeResultSignerFromEnvOptions {
  privateKeyEnv?: string;
  publicKeyEnv?: string;
  keyIdEnv?: string;
  allowDevelopmentFallback?: boolean;
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function normalizePem(pem: string): string {
  return pem.replace(/\\n/g, "\n").trim();
}

function sortJson(value: unknown): JsonValue {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sortJson(item));
  }

  if (typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const sortedEntries = Object.keys(objectValue)
      .sort()
      .map((key) => [key, sortJson(objectValue[key])] as const);
    return Object.fromEntries(sortedEntries);
  }

  throw new Error(`Unsupported JSON value type for canonicalization: ${typeof value}`);
}

export function canonicalizeJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

export function createEd25519ChallengeResultSigner(
  config: Ed25519ChallengeResultSignerConfig
): ChallengeResultSigner {
  const privateKeyPem = normalizePem(config.privateKeyPem);
  const publicKeyPem = normalizePem(config.publicKeyPem);
  const keyId = config.keyId.trim();

  if (!keyId) {
    throw new Error("ERR_INVALID_SIGNING_KEY_ID: keyId must be a non-empty string.");
  }

  const privateKey = createPrivateKey(privateKeyPem);
  const publicKey = createPublicKey(publicKeyPem);
  const exportedJwk = publicKey.export({ format: "jwk" }) as Record<string, unknown>;

  if (
    exportedJwk.kty !== "OKP" ||
    exportedJwk.crv !== "Ed25519" ||
    typeof exportedJwk.x !== "string"
  ) {
    throw new Error("ERR_INVALID_SIGNING_PUBLIC_KEY: expected an Ed25519 public key.");
  }

  const probe = Buffer.from("arena-challenge-result-signing-probe", "utf8");
  const probeSignature = cryptoSign(null, probe, privateKey);
  if (!cryptoVerify(null, probe, publicKey, probeSignature)) {
    throw new Error("ERR_INVALID_SIGNING_KEY_PAIR: provided Ed25519 keypair does not match.");
  }

  return {
    alg: "Ed25519",
    keyId,
    publicJwk: {
      kty: "OKP",
      crv: "Ed25519",
      x: exportedJwk.x,
      kid: keyId,
      use: "sig",
      alg: "EdDSA",
    },
    async sign(payloadCanonical: string): Promise<string> {
      const signature = cryptoSign(null, Buffer.from(payloadCanonical, "utf8"), privateKey);
      return signature.toString("base64url");
    },
    async verify(payloadCanonical: string, signature: string): Promise<boolean> {
      return cryptoVerify(
        null,
        Buffer.from(payloadCanonical, "utf8"),
        publicKey,
        Buffer.from(signature, "base64url")
      );
    },
  };
}

export function createChallengeResultSignerFromEnv(
  options: ChallengeResultSignerFromEnvOptions = {}
): ChallengeResultSigner | undefined {
  const privateKeyEnv = options.privateKeyEnv ?? process.env.ARENA_OPERATOR_SIGNING_PRIVATE_KEY_PEM;
  const publicKeyEnv = options.publicKeyEnv ?? process.env.ARENA_OPERATOR_SIGNING_PUBLIC_KEY_PEM;
  const keyIdEnv = options.keyIdEnv ?? process.env.ARENA_OPERATOR_SIGNING_KEY_ID;
  const allowDevelopmentFallback = options.allowDevelopmentFallback ?? false;

  const hasAnyConfiguredValue = Boolean(privateKeyEnv || publicKeyEnv || keyIdEnv);
  const hasAllConfiguredValues = Boolean(privateKeyEnv && publicKeyEnv && keyIdEnv);

  if (hasAllConfiguredValues) {
    return createEd25519ChallengeResultSigner({
      privateKeyPem: privateKeyEnv!,
      publicKeyPem: publicKeyEnv!,
      keyId: keyIdEnv!,
    });
  }

  if (hasAnyConfiguredValue) {
    throw new Error(
      "ERR_SIGNING_CONFIG_INCOMPLETE: set ARENA_OPERATOR_SIGNING_PRIVATE_KEY_PEM, ARENA_OPERATOR_SIGNING_PUBLIC_KEY_PEM, and ARENA_OPERATOR_SIGNING_KEY_ID together."
    );
  }

  if (!allowDevelopmentFallback) {
    return undefined;
  }

  return createEd25519ChallengeResultSigner({
    privateKeyPem: DEV_PRIVATE_KEY_PEM,
    publicKeyPem: DEV_PUBLIC_KEY_PEM,
    keyId: DEV_KEY_ID,
  });
}

export const defaultChallengeResultSigner = createChallengeResultSignerFromEnv();
