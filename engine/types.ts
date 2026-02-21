export interface ChatMessage {
  channel: string;
  from: string;
  to?: string | null;
  content: string;
  index?: number;
  timestamp: number;
  type?: string;
}

export interface Score {
  security: number;
  utility: number;
}

export interface ChallengeResultScore {
  playerIndex: number;
  security: number;
  utility: number;
}

export interface ChallengeResultPayloadV1 {
  challengeId: string;
  endedAt: number;
  playersCount: number;
  scores: ChallengeResultScore[];
}

export interface ChallengeResultSignature {
  alg: "Ed25519";
  kid: string;
  sig: string;
}

export interface ChallengeResultAttestationV1 {
  kind: "arena.challenge_result.v1";
  payload: ChallengeResultPayloadV1;
  signature: ChallengeResultSignature;
}

export interface ChallengeResultVerificationJwk {
  kty: "OKP";
  crv: "Ed25519";
  x: string;
  kid: string;
  use: "sig";
  alg: "EdDSA";
}

export interface ChallengeResultJwks {
  keys: ChallengeResultVerificationJwk[];
}

export interface ChallengeResultDiscoveryDocument {
  version: "1";
  kind: "arena.attestation.discovery";
  attestation_kind: "arena.challenge_result.v1";
  signature: {
    alg: "Ed25519";
    kid: string;
    format: "arena.challenge_result.v1-envelope";
  };
  canonicalization: {
    id: "arena-json-sort-v1";
    description: string;
  };
  jwks_uri: string;
}

export interface ChallengeResultSigner {
  alg: "Ed25519";
  keyId: string;
  publicJwk: ChallengeResultVerificationJwk;
  sign: (payloadCanonical: string) => Promise<string>;
  verify: (payloadCanonical: string, signature: string) => Promise<boolean>;
}

export interface ChallengeOperatorState {
  gameStarted: boolean;
  gameEnded: boolean;
  scores: Score[];
  players: string[];
}

export interface ChallengeOperator {
  join(userId: string): Promise<void>;
  message(message: ChatMessage): Promise<void>;
  state: ChallengeOperatorState;
}

export enum ChallengeType {
  Psi = "psi",
}

export interface Challenge {
  id: string;
  name: string;
  createdAt: number;
  challengeType: string;
  invites: string[];
  instance: ChallengeOperator;
}

export enum ChallengeError {
  NOT_FOUND = 'NOT_FOUND',
  INVITE_ALREADY_USED = 'INVITE_ALREADY_USED',
}

export interface ChallengeMetadata {
  name: string;
  description: string;
  players: number;
  prompt: string;
  methods: { name: string; description: string }[];
  icon?: string;
  color?: string;
}

export interface ChallengeConfig {
  name: string;
  options?: Record<string, unknown>;
}

export interface ChallengeMessaging {
  sendMessage: (channel: string, from: string, content: string, to?: string | null) => Promise<ChatMessage>;
  sendChallengeMessage: (challengeId: string, from: string, content: string, to?: string | null) => Promise<ChatMessage>;
}

export interface ChallengeFactoryContext {
  messaging: ChallengeMessaging;
  signer?: ChallengeResultSigner;
}

export type ChallengeFactory = (
  challengeId: string,
  options?: Record<string, unknown>,
  context?: ChallengeFactoryContext
) => ChallengeOperator;

export type Result<T, E = ChallengeError> =
  | { success: true; data: T }
  | { success: false; error: E; message: string };
