import { v4 as uuidv4 } from "uuid";
import {
  Challenge,
  ChallengeError,
  ChallengeFactory,
  ChallengeMetadata,
  Result,
} from "./types";
import { ChatEngine, createChatEngine } from "./chat/ChatEngine";
import { ArenaStorageAdapter, InMemoryArenaStorageAdapter } from "./storage/InMemoryArenaStorageAdapter";
import { AuthEngine } from "./auth/index";

export interface EngineOptions {
  storageAdapter?: ArenaStorageAdapter;
  chatEngine?: ChatEngine;
}

export class ArenaEngine {
  private readonly storageAdapter: ArenaStorageAdapter;
  private readonly challengeFactories: Map<string, ChallengeFactory>;
  private readonly challengeOptions: Map<string, Record<string, unknown>>;
  private readonly challengeMetadataMap: Map<string, ChallengeMetadata>;
  readonly chat: ChatEngine;
  readonly auth: AuthEngine;

  constructor(options: EngineOptions = {}) {
    this.storageAdapter = options.storageAdapter ?? new InMemoryArenaStorageAdapter();
    this.challengeFactories = new Map<string, ChallengeFactory>();
    this.challengeOptions = new Map<string, Record<string, unknown>>();
    this.challengeMetadataMap = new Map<string, ChallengeMetadata>();
    this.chat = options.chatEngine ?? createChatEngine();
    this.auth = new AuthEngine();
  }

  async clearRuntimeState(): Promise<void> {
    await Promise.all([
      this.storageAdapter.clearRuntimeState(),
      this.chat.clearRuntimeState(),
    ]);
  }

  async resolveSession(token: string, challengeId: string): Promise<string | null> {
    const playerIndex = this.auth.verifyToken(token, challengeId);
    if (playerIndex === null) return null;
    const challenge = await this.getChallenge(challengeId);
    return challenge?.invites[playerIndex] ?? null;
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

  async challengeJoin(invite: string, publicKey: string, signature: string) {
    const result = await this.getChallengeFromInvite(invite);

    if (!result.success) {
      return { error: result.message };
    }

    const challenge = result.data;

    // Authenticate join with Ed25519 signature
    const playerIndex = challenge.invites.indexOf(invite);
    const authResult = this.auth.authenticateJoin(challenge.id, invite, playerIndex, publicKey, signature);
    if ("error" in authResult) {
      return { error: authResult.error };
    }
    const sessionToken = authResult.sessionToken;
    if (!challenge.publicKeys) challenge.publicKeys = {};
    challenge.publicKeys[invite] = publicKey;
    await this.storageAdapter.setChallenge(challenge);

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
      sessionToken,
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

  async challengeSync(channel: string, from: string | undefined, index: number) {
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
