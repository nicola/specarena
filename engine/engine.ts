import { v4 as uuidv4 } from "uuid";
import {
  Challenge,
  ChallengeError,
  ChallengeFactory,
  ChallengeResultDiscoveryDocument,
  ChallengeResultJwks,
  ChallengeResultSigner,
  ChallengeMetadata,
  Result,
} from "./types";
import { ChatEngine, createChatEngine } from "./chat/ChatEngine";
import { ArenaStorageAdapter, InMemoryArenaStorageAdapter } from "./storage/InMemoryArenaStorageAdapter";
import {
  ARENA_ATTESTATION_SIGNATURE_FORMAT,
  ARENA_CANONICALIZATION_DESCRIPTION,
  ARENA_CANONICALIZATION_ID,
  createChallengeResultSignerFromEnv
} from "./signing/ChallengeResultSigner";

export interface EngineOptions {
  storageAdapter?: ArenaStorageAdapter;
  chatEngine?: ChatEngine;
  signer?: ChallengeResultSigner | null;
}

export class ArenaEngine {
  private readonly storageAdapter: ArenaStorageAdapter;
  private readonly challengeFactories: Map<string, ChallengeFactory>;
  private readonly challengeOptions: Map<string, Record<string, unknown>>;
  private readonly challengeMetadataMap: Map<string, ChallengeMetadata>;
  private readonly signer?: ChallengeResultSigner;
  readonly chat: ChatEngine;

  constructor(options: EngineOptions = {}) {
    this.storageAdapter = options.storageAdapter ?? new InMemoryArenaStorageAdapter();
    this.challengeFactories = new Map<string, ChallengeFactory>();
    this.challengeOptions = new Map<string, Record<string, unknown>>();
    this.challengeMetadataMap = new Map<string, ChallengeMetadata>();
    this.chat = options.chatEngine ?? createChatEngine();
    this.signer = options.signer === null
      ? undefined
      : options.signer ?? createChallengeResultSignerFromEnv();
  }

  async clearRuntimeState(): Promise<void> {
    await Promise.all([
      this.storageAdapter.clearRuntimeState(),
      this.chat.clearRuntimeState(),
    ]);
  }

  registerChallengeFactory(type: string, factory: ChallengeFactory, options?: Record<string, unknown>): void {
    this.challengeFactories.set(type, factory);
    if (options) {
      this.challengeOptions.set(type, options);
    }
  }

  registerChallengeMetadata(type: string, metadata: ChallengeMetadata): void {
    this.challengeMetadataMap.set(type, metadata);
  }

  getChallengeMetadata(name: string): ChallengeMetadata | undefined {
    return this.challengeMetadataMap.get(name);
  }

  getAllChallengeMetadata(): Record<string, ChallengeMetadata> {
    return Object.fromEntries(this.challengeMetadataMap);
  }

  getAttestationJwks(): ChallengeResultJwks {
    if (!this.signer) {
      throw new Error("ERR_ATTESTATION_SIGNING_DISABLED");
    }
    return {
      keys: [this.signer.publicJwk],
    };
  }

  getAttestationDiscovery(origin: string): ChallengeResultDiscoveryDocument {
    if (!this.signer) {
      throw new Error("ERR_ATTESTATION_SIGNING_DISABLED");
    }
    const normalizedOrigin = origin.replace(/\/+$/, "");
    return {
      version: "1",
      kind: "arena.attestation.discovery",
      attestation_kind: "arena.challenge_result.v1",
      signature: {
        alg: this.signer.alg,
        kid: this.signer.keyId,
        format: ARENA_ATTESTATION_SIGNATURE_FORMAT,
      },
      canonicalization: {
        id: ARENA_CANONICALIZATION_ID,
        description: ARENA_CANONICALIZATION_DESCRIPTION,
      },
      jwks_uri: `${normalizedOrigin}/.well-known/jwks.json`,
    };
  }

  async listChallenges(): Promise<Challenge[]> {
    return this.storageAdapter.listChallenges();
  }

  async createChallenge(challengeType: string): Promise<Challenge> {
    const id = crypto.randomUUID();
    const factory = this.challengeFactories.get(challengeType);

    if (!factory) {
      throw new Error(`Unknown challenge type: ${challengeType}`);
    }

    const options = this.challengeOptions.get(challengeType);
    const instance = factory(id, options, {
      messaging: this.chat,
      signer: this.signer,
    });

    const challenge: Challenge = {
      id,
      name: challengeType,
      createdAt: Date.now(),
      challengeType,
      invites: [`inv_${uuidv4()}`, `inv_${uuidv4()}`],
      instance,
    };

    await this.storageAdapter.setChallenge(challenge);
    return challenge;
  }

  private isInviteFree(challenge: Challenge, invite: string): boolean {
    return !challenge.instance?.state?.players?.includes(invite);
  }

  filterValidInvites(_invites: string[]): string[] {
    return [];
  }

  async getInvite(invite: string): Promise<Result<Challenge>> {
    const result = await this.getChallengeFromInvite(invite);
    if (!result.success) {
      return result;
    }
    if (!this.isInviteFree(result.data, invite)) {
      return {
        success: false,
        error: ChallengeError.INVITE_ALREADY_USED,
        message: `Invite already used: ${invite}`,
      };
    }
    return result;
  }

  async getChallengeFromInvite(invite: string): Promise<Result<Challenge>> {
    const challenge = (await this.storageAdapter.listChallenges())
      .find((c) => c.invites.includes(invite));
    if (challenge) {
      return { success: true, data: challenge };
    }
    return {
      success: false,
      error: ChallengeError.NOT_FOUND,
      message: `Challenge not found for invite: ${invite}`,
    };
  }

  async getChallenge(challengeId: string): Promise<Challenge | undefined> {
    return this.storageAdapter.getChallenge(challengeId);
  }

  async getChallengesByType(challengeType: string): Promise<Challenge[]> {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    return (await this.storageAdapter.listChallenges())
      .filter((c) => c.challengeType === challengeType)
      .filter((c) => {
        const gameStarted = c.instance?.state?.gameStarted ?? false;
        const createdMoreThan10MinsAgo = c.createdAt < tenMinutesAgo;
        return gameStarted || !createdMoreThan10MinsAgo;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async challengeJoin(invite: string) {
    const result = await this.getChallengeFromInvite(invite);

    if (!result.success) {
      return { error: result.message };
    }

    const challenge = result.data;

    let joinError: string | undefined;
    try {
      await challenge.instance.join(invite);
    } catch (error) {
      joinError = error instanceof Error ? error.message : String(error);
    }

    if (joinError) {
      return { error: joinError };
    }

    const metadata = this.getChallengeMetadata(challenge.challengeType);
    return {
      ChallengeID: challenge.id,
      ChallengeInfo: metadata,
    };
  }

  async challengeMessage(challengeId: string, from: string, messageType: string, content: string) {
    const challenge = await this.getChallenge(challengeId);

    await this.chat.sendChallengeMessage(challengeId, from, (messageType ? `(${messageType}) ` : "") + content, "operator");

    if (!challenge || !challenge.instance) {
      return { error: "Challenge not found" };
    }

    try {
      await challenge.instance.message({
        channel: challengeId,
        from,
        type: messageType,
        content,
        timestamp: Date.now(),
      });
      return { ok: "Message sent" };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  async challengeSync(channel: string, from: string, index: number) {
    return this.chat.challengeSync(channel, from, index);
  }
}

export function createEngine(options: EngineOptions = {}): ArenaEngine {
  return new ArenaEngine(options);
}

export const defaultEngine = createEngine();
export { ChatEngine, createChatEngine, defaultChatEngine } from "./chat/ChatEngine";
export { ArenaStorageAdapter, InMemoryArenaStorageAdapter } from "./storage/InMemoryArenaStorageAdapter";
export { ChatStorageAdapter, InMemoryChatStorageAdapter } from "./storage/InMemoryChatStorageAdapter";
export {
  ARENA_ATTESTATION_SIGNATURE_FORMAT,
  ARENA_CANONICALIZATION_DESCRIPTION,
  ARENA_CANONICALIZATION_ID,
  defaultChallengeResultSigner,
  canonicalizeJson,
  createChallengeResultSignerFromEnv,
  createEd25519ChallengeResultSigner,
} from "./signing/ChallengeResultSigner";
