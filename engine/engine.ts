const STALE_CHALLENGE_TIMEOUT_MS = 10 * 60 * 1000;

import {
  Challenge,
  ChallengeError,
  ChallengeFactory,
  ChallengeMetadata,
  ChallengeOperatorError,
  ChallengeRecord,
  Result,
  fromChallengeChannel,
  toChallengeChannel,
} from "./types";
import { ChatEngine, createChatEngine } from "./chat/ChatEngine";
import { ArenaStorageAdapter, InMemoryArenaStorageAdapter } from "./storage/InMemoryArenaStorageAdapter";
import { ScoringModule } from "./scoring/index";
import { UserStorageAdapter, InMemoryUserStorageAdapter } from "./users/index";

export interface EngineOptions {
  storageAdapter?: ArenaStorageAdapter;
  chatEngine?: ChatEngine;
  scoring?: ScoringModule;
  userStorage?: UserStorageAdapter;
}

export class ArenaEngine {
  private readonly storageAdapter: ArenaStorageAdapter;
  readonly users: UserStorageAdapter;
  private readonly challengeFactories: Map<string, ChallengeFactory>;
  private readonly challengeOptions: Map<string, Record<string, unknown>>;
  private readonly challengeMetadataMap: Map<string, ChallengeMetadata>;
  readonly chat: ChatEngine;
  scoring: ScoringModule | null;

  constructor(options: EngineOptions = {}) {
    this.storageAdapter = options.storageAdapter ?? new InMemoryArenaStorageAdapter();
    this.users = options.userStorage ?? new InMemoryUserStorageAdapter();
    this.challengeFactories = new Map<string, ChallengeFactory>();
    this.challengeOptions = new Map<string, Record<string, unknown>>();
    this.challengeMetadataMap = new Map<string, ChallengeMetadata>();
    this.scoring = options.scoring ?? null;
    this.chat = options.chatEngine ?? createChatEngine({
      isChannelRevealed: async (channel) => {
        const challengeId = fromChallengeChannel(channel);
        if (!challengeId) return false;
        const record = await this.storageAdapter.getChallenge(challengeId);
        return record?.gameEnded ?? false;
      },
      onChallengeEvent: async (challengeId, event) => {
        if (event.type !== "game_ended" || !this.scoring) return;
        const record = await this.storageAdapter.getChallenge(challengeId);
        if (!record) return;
        const result = ScoringModule.challengeToGameResult(record);
        if (!result) return;
        this.scoring.recordGame(result)
          .catch((err) => console.error("Scoring recordGame failed:", err));
      },
    });
  }

  async clearRuntimeState(): Promise<void> {
    await Promise.all([
      this.storageAdapter.clearRuntimeState(),
      this.chat.clearRuntimeState(),
      this.users.clearRuntimeState(),
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

  private isChallengeStale(record: ChallengeRecord, now: number = Date.now()): boolean {
    const cutoff = now - STALE_CHALLENGE_TIMEOUT_MS;
    return !record.gameEnded && record.createdAt < cutoff;
  }

  private async deleteChallengeFull(id: string): Promise<void> {
    await this.storageAdapter.deleteChallenge(id);
    await this.chat.deleteChannel(id);
    await this.chat.deleteChannel(toChallengeChannel(id));
  }

  async pruneStaleChallenges(now: number = Date.now()): Promise<number> {
    const challenges = await this.storageAdapter.listChallenges();
    const stale = challenges.filter((c) => this.isChallengeStale(c, now));
    if (stale.length === 0) {
      return 0;
    }

    await Promise.all(stale.map((c) => this.deleteChallengeFull(c.id)));
    return stale.length;
  }

  async listChallenges(): Promise<ChallengeRecord[]> {
    return this.storageAdapter.listChallenges();
  }

  async createChallenge(challengeType: string): Promise<Challenge> {
    const id = crypto.randomUUID();
    const factory = this.challengeFactories.get(challengeType);

    if (!factory) {
      throw new Error(`Unknown challenge type: ${challengeType}`);
    }

    const options = this.challengeOptions.get(challengeType);
    const instance = factory(id, options, { messaging: this.chat });

    const record: ChallengeRecord = {
      id,
      name: challengeType,
      createdAt: Date.now(),
      challengeType,
      invites: [`inv_${crypto.randomUUID()}`, `inv_${crypto.randomUUID()}`],
      ...instance.save(),
    };
    Object.defineProperty(record, "instance", { value: instance, enumerable: false, configurable: true });
    const challenge = record as Challenge;

    await this.storageAdapter.setChallenge(challenge);
    return challenge;
  }

  async restoreChallenge(record: ChallengeRecord): Promise<Challenge> {
    const challenge = this.hydrate(record);
    await this.storageAdapter.setChallenge(challenge);
    return challenge;
  }

  private hydrate(record: ChallengeRecord): Challenge {
    const factory = this.challengeFactories.get(record.challengeType);
    if (!factory) throw new Error(`Unknown challenge type: ${record.challengeType}`);
    const options = this.challengeOptions.get(record.challengeType);
    const instance = factory(record.id, options, { messaging: this.chat });
    instance.restore(record);
    Object.defineProperty(record, "instance", { value: instance, enumerable: false, configurable: true });
    return record as Challenge;
  }

  private async persistChallenge(challenge: Challenge): Promise<void> {
    Object.assign(challenge, challenge.instance.save());
    await this.storageAdapter.setChallenge(challenge);
  }

  private isInviteFree(challenge: ChallengeRecord, invite: string): boolean {
    return !challenge.players.includes(invite);
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
    const record = await this.storageAdapter.getChallengeFromInvite(invite);
    if (!record) {
      return {
        success: false,
        error: ChallengeError.NOT_FOUND,
        message: `Challenge not found for invite: ${invite}`,
      };
    }
    return { success: true, data: this.hydrate(record) };
  }

  async getChallenge(challengeId: string): Promise<Challenge | undefined> {
    const record = await this.storageAdapter.getChallenge(challengeId);
    if (!record) {
      return undefined;
    }
    if (this.isChallengeStale(record)) {
      await this.deleteChallengeFull(record.id);
      return undefined;
    }

    return this.hydrate(record);
  }

  async getChallengesByUserId(userId: string): Promise<ChallengeRecord[]> {
    return this.storageAdapter.getChallengesByUserId(userId);
  }

  async getChallengesByType(challengeType: string): Promise<ChallengeRecord[]> {
    return (await this.storageAdapter.listChallenges())
      .filter((c) => c.challengeType === challengeType && !this.isChallengeStale(c))
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async challengeJoin(invite: string, userId?: string) {
    const result = await this.getChallengeFromInvite(invite);

    if (!result.success) {
      return { error: result.message };
    }

    const challenge = result.data;

    try {
      await challenge.instance.join(invite, userId);
    } catch (error) {
      if (error instanceof ChallengeOperatorError) {
        return { error: error.message, code: error.code };
      }
      return { error: error instanceof Error ? error.message : String(error) };
    }

    await this.persistChallenge(challenge);

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
      await this.persistChallenge(challenge);
      return { ok: "Message sent" };
    } catch (error) {
      if (error instanceof ChallengeOperatorError) {
        return { error: error.message, code: error.code };
      }
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  async getPlayerIdentities(challengeId: string): Promise<Record<string, string> | null> {
    const record = await this.storageAdapter.getChallenge(challengeId);
    if (!record?.gameEnded) return null;
    return record.playerIdentities;
  }

  async resolvePlayerIdentity(challengeId: string, userIndex: number): Promise<string | null> {
    const record = await this.storageAdapter.getChallenge(challengeId);
    return record?.players?.[userIndex] ?? null;
  }

  async challengeSync(channel: string, viewer: string | null, index: number) {
    return this.chat.challengeSync(channel, viewer, index);
  }

  async chatSync(channel: string, viewer: string | null, index: number) {
    return this.chat.chatSync(channel, viewer, index);
  }
}

export function createEngine(options: EngineOptions = {}): ArenaEngine {
  return new ArenaEngine(options);
}

export const defaultEngine = createEngine();
export { ChatEngine, createChatEngine, defaultChatEngine } from "./chat/ChatEngine";
export { ArenaStorageAdapter, InMemoryArenaStorageAdapter } from "./storage/InMemoryArenaStorageAdapter";
export { ChatStorageAdapter, InMemoryChatStorageAdapter } from "./storage/InMemoryChatStorageAdapter";
export { UserProfile, UserStorageAdapter, InMemoryUserStorageAdapter } from "./users/index";
