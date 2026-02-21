import {
  createHmac,
  createHash,
  createPublicKey,
  randomBytes,
  randomUUID,
  timingSafeEqual,
  verify as verifySignature,
} from "node:crypto";
import { decodeBase58 } from "./base58";

const AUTH_CODES = {
  authRequired: "AUTH_REQUIRED",
  invalidDid: "INVALID_DID",
  invalidSignature: "INVALID_SIGNATURE",
  nonceExpired: "NONCE_EXPIRED",
  nonceReused: "NONCE_REUSED",
  nonceInvalid: "NONCE_INVALID",
  badTimestamp: "BAD_TIMESTAMP",
  tokenInvalid: "TOKEN_INVALID",
  tokenExpired: "TOKEN_EXPIRED",
  tokenScopeMismatch: "TOKEN_SCOPE_MISMATCH",
  tokenChallengeMismatch: "TOKEN_CHALLENGE_MISMATCH",
} as const;

export type AuthErrorCode = (typeof AUTH_CODES)[keyof typeof AUTH_CODES];

interface AuthErrorResult {
  success: false;
  code: AuthErrorCode;
  message: string;
}

interface AuthSuccessResult<T> {
  success: true;
  data: T;
}

type AuthResult<T> = AuthErrorResult | AuthSuccessResult<T>;

interface NonceRecord {
  nonceId: string;
  nonce: string;
  invite: string;
  purpose: "join";
  expiresAt: number;
  used: boolean;
}

export interface IssueJoinNonceResult {
  nonceId: string;
  nonce: string;
  domain: string;
  expiresAt: number;
}

export interface VerifyJoinInput {
  invite: string;
  did?: string;
  nonceId?: string;
  signature?: string;
  timestamp?: number;
}

export interface SessionClaims {
  sub: string;
  invite: string;
  challengeId: string;
  scope: string[];
  iat: number;
  exp: number;
  jti: string;
}

export interface IssueSessionInput {
  did: string;
  invite: string;
  challengeId: string;
  scope: string[];
}

export interface IssueSessionResult {
  accessToken: string;
  expiresAt: number;
  did: string;
  invite: string;
  challengeId: string;
}

export interface AuthManagerOptions {
  nonceTtlMs?: number;
  sessionTtlMs?: number;
  allowedClockSkewMs?: number;
  domain?: string;
  requireJoinProof?: boolean;
  sessionHmacKey?: string;
}

function bufferFromBase64(input: string): Buffer {
  // Accept base64url and base64.
  try {
    return Buffer.from(input, "base64url");
  } catch {
    return Buffer.from(input, "base64");
  }
}

interface SessionTokenHeader {
  alg: "HS256";
  typ: "AST";
}

function encodeJsonBase64Url(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf-8").toString("base64url");
}

function decodeJsonBase64Url<T>(input: string): T {
  const text = Buffer.from(input, "base64url").toString("utf-8");
  return JSON.parse(text) as T;
}

function isValidSessionClaims(value: unknown): value is SessionClaims {
  if (!value || typeof value !== "object") {
    return false;
  }
  const v = value as Partial<SessionClaims>;
  return (
    typeof v.sub === "string"
    && typeof v.invite === "string"
    && typeof v.challengeId === "string"
    && Array.isArray(v.scope)
    && v.scope.every((s) => typeof s === "string")
    && typeof v.iat === "number"
    && Number.isFinite(v.iat)
    && typeof v.exp === "number"
    && Number.isFinite(v.exp)
    && typeof v.jti === "string"
  );
}

export function buildJoinProofPayload(input: {
  domain: string;
  invite: string;
  nonce: string;
  nonceId: string;
  timestamp: number;
  did: string;
}): string {
  return [
    "arena-auth-v1",
    input.domain,
    input.invite,
    input.nonce,
    input.nonceId,
    String(input.timestamp),
    input.did,
  ].join("\n");
}

function extractEd25519PublicKeyFromDidKey(did: string): Uint8Array {
  if (!did.startsWith("did:key:z")) {
    throw new Error("DID must be did:key with multibase base58btc encoding");
  }

  const multibase = did.slice("did:key:z".length);
  const decoded = decodeBase58(multibase);

  // Ed25519 public key multicodec: 0xed01 + 32-byte key
  if (decoded.length !== 34 || decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error("Unsupported did:key format; expected ed25519 public key");
  }

  return decoded.slice(2);
}

function createEd25519PublicKey(rawPublicKey: Uint8Array) {
  // SPKI DER prefix for Ed25519.
  const prefix = Buffer.from("302a300506032b6570032100", "hex");
  const der = Buffer.concat([prefix, Buffer.from(rawPublicKey)]);
  return createPublicKey({ key: der, format: "der", type: "spki" });
}

export class AuthManager {
  private readonly nonceTtlMs: number;
  private readonly sessionTtlMs: number;
  private readonly allowedClockSkewMs: number;
  private readonly domain: string;
  private readonly requireJoinProof: boolean;
  private readonly sessionHmacKey: Buffer;
  private readonly nonces: Map<string, NonceRecord>;

  constructor(options: AuthManagerOptions = {}) {
    this.nonceTtlMs = options.nonceTtlMs ?? 60_000;
    this.sessionTtlMs = options.sessionTtlMs ?? 30 * 60_000;
    this.allowedClockSkewMs = options.allowedClockSkewMs ?? 5 * 60_000;
    this.domain = options.domain ?? process.env.ARENA_AUTH_DOMAIN ?? "arena";
    this.requireJoinProof = options.requireJoinProof
      ?? (process.env.ARENA_REQUIRE_DID_PROOF === "true");
    const configuredHmacKey = options.sessionHmacKey ?? process.env.ARENA_SESSION_HMAC_KEY;
    if (configuredHmacKey) {
      this.sessionHmacKey = Buffer.from(configuredHmacKey, "utf-8");
    } else {
      this.sessionHmacKey = randomBytes(32);
      console.warn(
        "[AuthManager] ARENA_SESSION_HMAC_KEY is not set. Using ephemeral signing key; session tokens become invalid after restart."
      );
    }
    this.nonces = new Map();
  }

  async clearRuntimeState(): Promise<void> {
    this.nonces.clear();
  }

  issueJoinNonce(invite: string): IssueJoinNonceResult {
    const now = Date.now();
    const nonceId = `nonce_${randomUUID()}`;
    const nonce = randomBytes(24).toString("base64url");
    const record: NonceRecord = {
      nonceId,
      nonce,
      invite,
      purpose: "join",
      expiresAt: now + this.nonceTtlMs,
      used: false,
    };
    this.nonces.set(nonceId, record);

    return {
      nonceId,
      nonce,
      domain: this.domain,
      expiresAt: record.expiresAt,
    };
  }

  getDomain(): string {
    return this.domain;
  }

  isJoinProofRequired(): boolean {
    return this.requireJoinProof;
  }

  private consumeJoinNonce(nonceId: string, invite: string): AuthResult<NonceRecord> {
    const now = Date.now();
    const nonce = this.nonces.get(nonceId);

    if (!nonce || nonce.purpose !== "join" || nonce.invite !== invite) {
      return {
        success: false,
        code: AUTH_CODES.nonceInvalid,
        message: "Invalid join nonce",
      };
    }

    if (nonce.used) {
      return {
        success: false,
        code: AUTH_CODES.nonceReused,
        message: "Join nonce has already been used",
      };
    }

    if (nonce.expiresAt < now) {
      return {
        success: false,
        code: AUTH_CODES.nonceExpired,
        message: "Join nonce expired",
      };
    }

    nonce.used = true;
    return { success: true, data: nonce };
  }

  verifyJoinProof(input: VerifyJoinInput): AuthResult<{ did: string }> {
    const hasProofFields = Boolean(input.did || input.nonceId || input.signature || input.timestamp);
    const hasAllProofFields = Boolean(input.did && input.nonceId && input.signature && input.timestamp !== undefined);

    if (!hasProofFields && !this.requireJoinProof) {
      return {
        success: true,
        data: { did: this.deriveAnonymousDid(input.invite) },
      };
    }

    if (!hasAllProofFields) {
      return {
        success: false,
        code: AUTH_CODES.invalidSignature,
        message: this.requireJoinProof
          ? "did, nonceId, signature and timestamp are required"
          : "Either provide full did proof fields or none of them",
      };
    }

    const timestamp = Number(input.timestamp);
    if (!Number.isFinite(timestamp)) {
      return {
        success: false,
        code: AUTH_CODES.badTimestamp,
        message: "timestamp must be a valid number",
      };
    }

    const now = Date.now();
    if (Math.abs(now - timestamp) > this.allowedClockSkewMs) {
      return {
        success: false,
        code: AUTH_CODES.badTimestamp,
        message: "timestamp outside allowed skew window",
      };
    }

    const nonceResult = this.consumeJoinNonce(input.nonceId!, input.invite);
    if (!nonceResult.success) {
      return nonceResult;
    }

    let publicKey: ReturnType<typeof createEd25519PublicKey>;
    try {
      const rawPublicKey = extractEd25519PublicKeyFromDidKey(input.did!);
      publicKey = createEd25519PublicKey(rawPublicKey);
    } catch (error) {
      return {
        success: false,
        code: AUTH_CODES.invalidDid,
        message: error instanceof Error ? error.message : "Invalid did:key",
      };
    }

    const payload = buildJoinProofPayload({
      domain: this.domain,
      invite: input.invite,
      nonce: nonceResult.data.nonce,
      nonceId: input.nonceId!,
      timestamp,
      did: input.did!,
    });

    let signature: Buffer;
    try {
      signature = bufferFromBase64(input.signature!);
    } catch {
      return {
        success: false,
        code: AUTH_CODES.invalidSignature,
        message: "Invalid signature encoding",
      };
    }

    const isValid = verifySignature(
      null,
      Buffer.from(payload, "utf-8"),
      publicKey,
      signature
    );

    if (!isValid) {
      return {
        success: false,
        code: AUTH_CODES.invalidSignature,
        message: "Invalid signature for did:key proof",
      };
    }

    return { success: true, data: { did: input.did! } };
  }

  private deriveAnonymousDid(invite: string): string {
    const digest = createHash("sha256").update(invite, "utf-8").digest("hex").slice(0, 32);
    return `did:arena:anon:${digest}`;
  }

  private signTokenPayload(header: SessionTokenHeader, claims: SessionClaims): string {
    const headerSegment = encodeJsonBase64Url(header);
    const claimsSegment = encodeJsonBase64Url(claims);
    const input = `${headerSegment}.${claimsSegment}`;
    const signature = createHmac("sha256", this.sessionHmacKey)
      .update(input, "utf-8")
      .digest("base64url");
    return `${input}.${signature}`;
  }

  issueSession(input: IssueSessionInput): IssueSessionResult {
    const now = Date.now();
    const claims: SessionClaims = {
      sub: input.did,
      invite: input.invite,
      challengeId: input.challengeId,
      scope: input.scope,
      iat: Math.floor(now / 1000),
      exp: Math.floor((now + this.sessionTtlMs) / 1000),
      jti: randomUUID(),
    };
    const token = this.signTokenPayload({ alg: "HS256", typ: "AST" }, claims);

    return {
      accessToken: token,
      expiresAt: claims.exp * 1000,
      did: input.did,
      invite: input.invite,
      challengeId: input.challengeId,
    };
  }

  extractBearerToken(authorizationHeader: string | undefined): string | null {
    if (!authorizationHeader) {
      return null;
    }
    const [scheme, value] = authorizationHeader.split(" ");
    if (!scheme || !value || scheme.toLowerCase() !== "bearer") {
      return null;
    }
    return value.trim();
  }

  verifySessionToken(token: string, requiredScope?: string): AuthResult<SessionClaims> {
    const parts = token.split(".");
    if (parts.length !== 3) {
      return {
        success: false,
        code: AUTH_CODES.tokenInvalid,
        message: "Invalid session token",
      };
    }
    const [headerSegment, claimsSegment, signatureSegment] = parts;

    let providedSignature: Buffer;
    try {
      providedSignature = Buffer.from(signatureSegment, "base64url");
    } catch {
      return {
        success: false,
        code: AUTH_CODES.tokenInvalid,
        message: "Invalid session token",
      };
    }

    const signingInput = `${headerSegment}.${claimsSegment}`;
    const expectedSignature = createHmac("sha256", this.sessionHmacKey)
      .update(signingInput, "utf-8")
      .digest();

    if (providedSignature.length !== expectedSignature.length
      || !timingSafeEqual(providedSignature, expectedSignature)) {
      return {
        success: false,
        code: AUTH_CODES.tokenInvalid,
        message: "Invalid session token",
      };
    }

    let header: SessionTokenHeader;
    let claims: SessionClaims;
    try {
      header = decodeJsonBase64Url<SessionTokenHeader>(headerSegment);
      claims = decodeJsonBase64Url<SessionClaims>(claimsSegment);
    } catch {
      return {
        success: false,
        code: AUTH_CODES.tokenInvalid,
        message: "Invalid session token",
      };
    }

    if (header.alg !== "HS256" || header.typ !== "AST" || !isValidSessionClaims(claims)) {
      return {
        success: false,
        code: AUTH_CODES.tokenInvalid,
        message: "Invalid session token",
      };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    if (claims.exp <= nowSeconds) {
      return {
        success: false,
        code: AUTH_CODES.tokenExpired,
        message: "Session token expired",
      };
    }

    if (requiredScope && !claims.scope.includes(requiredScope)) {
      return {
        success: false,
        code: AUTH_CODES.tokenScopeMismatch,
        message: `Missing required scope: ${requiredScope}`,
      };
    }

    return { success: true, data: claims };
  }

  revokeSessionsForChallenge(_challengeId: string): void {
    // Stateless tokens cannot be revoked per-challenge without state.
  }

  buildAuthRequiredError(): AuthErrorResult {
    return {
      success: false,
      code: AUTH_CODES.authRequired,
      message: "Authorization bearer token is required",
    };
  }

  buildChallengeMismatchError(expectedChallengeId: string): AuthErrorResult {
    return {
      success: false,
      code: AUTH_CODES.tokenChallengeMismatch,
      message: `Session token is not valid for challenge ${expectedChallengeId}`,
    };
  }
}

export function createAuthManager(options: AuthManagerOptions = {}): AuthManager {
  return new AuthManager(options);
}
