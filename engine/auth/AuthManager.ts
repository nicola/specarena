import { createHash, randomBytes, randomUUID } from "node:crypto";
import bs58 from "bs58";
import { JWTPayload, SignJWT, errors as joseErrors, jwtVerify } from "jose";

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

function hmacKeyFromString(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function isValidScope(scope: unknown): scope is string[] {
  return Array.isArray(scope) && scope.every((item) => typeof item === "string");
}

function sessionClaimsFromPayload(payload: JWTPayload): SessionClaims | null {
  const invite = payload.invite;
  const challengeId = payload.challengeId;
  const scope = payload.scope;
  const iat = payload.iat;
  const exp = payload.exp;
  const jti = payload.jti;
  const sub = payload.sub;

  if (typeof sub !== "string") return null;
  if (typeof invite !== "string") return null;
  if (typeof challengeId !== "string") return null;
  if (!isValidScope(scope)) return null;
  if (typeof iat !== "number") return null;
  if (typeof exp !== "number") return null;
  if (typeof jti !== "string") return null;

  return {
    sub,
    invite,
    challengeId,
    scope,
    iat,
    exp,
    jti,
  };
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
  const decoded = bs58.decode(multibase);

  // Ed25519 public key multicodec: 0xed01 + 32-byte key
  if (decoded.length !== 34 || decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error("Unsupported did:key format; expected ed25519 public key");
  }

  return decoded.slice(2);
}

export class AuthManager {
  private readonly nonceTtlMs: number;
  private readonly sessionTtlMs: number;
  private readonly allowedClockSkewMs: number;
  private readonly domain: string;
  private readonly requireJoinProof: boolean;
  private readonly sessionHmacKey: Uint8Array;
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
      this.sessionHmacKey = hmacKeyFromString(configuredHmacKey);
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

  async verifyJoinProof(input: VerifyJoinInput): Promise<AuthResult<{ did: string }>> {
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

    let rawPublicKey: Uint8Array;
    try {
      rawPublicKey = extractEd25519PublicKeyFromDidKey(input.did!);
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

    let signature: Uint8Array;
    try {
      signature = bufferFromBase64(input.signature!);
    } catch {
      return {
        success: false,
        code: AUTH_CODES.invalidSignature,
        message: "Invalid signature encoding",
      };
    }

    let isValid = false;
    try {
      const publicKey = await crypto.subtle.importKey(
        "raw",
        rawPublicKey,
        { name: "Ed25519" },
        false,
        ["verify"]
      );
      isValid = await crypto.subtle.verify(
        "Ed25519",
        publicKey,
        signature,
        new TextEncoder().encode(payload)
      );
    } catch {
      isValid = false;
    }

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

  async issueSession(input: IssueSessionInput): Promise<IssueSessionResult> {
    const iat = Math.floor(Date.now() / 1000);
    const exp = Math.floor((Date.now() + this.sessionTtlMs) / 1000);
    const jti = randomUUID();

    const token = await new SignJWT({
      invite: input.invite,
      challengeId: input.challengeId,
      scope: input.scope,
      jti,
    })
      .setProtectedHeader({ alg: "HS256", typ: "AST" })
      .setSubject(input.did)
      .setIssuedAt(iat)
      .setExpirationTime(exp)
      .sign(this.sessionHmacKey);

    return {
      accessToken: token,
      expiresAt: exp * 1000,
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

  async verifySessionToken(token: string, requiredScope?: string): Promise<AuthResult<SessionClaims>> {
    let payload: JWTPayload;
    let typ: string | undefined;
    try {
      const result = await jwtVerify(token, this.sessionHmacKey, {
        algorithms: ["HS256"],
      });
      payload = result.payload;
      typ = result.protectedHeader.typ;
    } catch (error) {
      if (error instanceof joseErrors.JWTExpired) {
        return {
          success: false,
          code: AUTH_CODES.tokenExpired,
          message: "Session token expired",
        };
      }
      return {
        success: false,
        code: AUTH_CODES.tokenInvalid,
        message: "Invalid session token",
      };
    }

    if (typ !== "AST") {
      return {
        success: false,
        code: AUTH_CODES.tokenInvalid,
        message: "Invalid session token",
      };
    }

    const claims = sessionClaimsFromPayload(payload);
    if (!claims) {
      return {
        success: false,
        code: AUTH_CODES.tokenInvalid,
        message: "Invalid session token",
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
