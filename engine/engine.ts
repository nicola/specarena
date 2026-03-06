const STALE_CHALLENGE_TIMEOUT_MS = 10 * 60 * 1000;

import {
  Challenge,
  ChallengeError,
  ChallengeFactory,
  ChallengeMetadata,
  ChallengeOperator,
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
  private readonly operators = new Map<string, ChallengeOperator>();
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
        const challenge = await this.getChallenge(challengeId);
        return challenge?.instance?.state?.gameEnded ?? false;
      },
      onChallengeEvent: async (challengeId, event) => {
        if (event.type !== "game_ended" || !this.scoring) return;
        const challenge = await this.getChallenge(challengeId);
        if (!challenge) return;
        const result = ScoringModule.challengeToGameResult(challenge);
        if (!result) return;
        this.scoring.recordGame(result)
          .catch((err) => console.error("Scoring recordGame failed:", err));
      },
    });
  }

  async clearRuntimeState(): Promise<void> {
    this.operators.clear();
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
    const gameEnded = record.state?.gameEnded ?? false;
    const cutoff = now - STALE_CHALLENGE_TIMEOUT_MS;
    return !gameEnded && record.createdAt < cutoff;
  }

  private async deleteChallengeById(id: string): Promise<void> {
    this.operators.delete(id);
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

    await Promise.all(stale.map((c) => this.deleteChallengeById(c.id)));
    return stale.length;
  }

  async listChallenges(): Promise<ChallengeRecord[]> {
    return this.storageAdapter.listChallenges();
  }

  private getOrCreateOperator(record: ChallengeRecord): ChallengeOperator {
    let instance = this.operators.get(record.id);
    if (instance) return instance;

    instance = this.instantiateChallenge(record);
    this.operators.set(record.id, instance);
    // Keep record.state in sync with operator (same reference for in-memory)
    record.state = instance.state;
    return instance;
  }

  private instantiateChallenge(record: ChallengeRecord): ChallengeOperator {
    const factory = this.challengeFactories.get(record.challengeType);
    if (!factory) throw new Error(`Unknown challenge type: ${record.challengeType}`);
    const options = this.challengeOptions.get(record.challengeType);
    return factory(record.id, options, {
      messaging: this.chat,
      snapshot: { state: record.state, privateState: record.privateState },
    });
  }

  private toChallenge(record: ChallengeRecord, instance: ChallengeOperator): Challenge {
    // Assign instance directly to preserve reference identity with the stored record.
    // This ensures in-memory mutations (e.g. state changes) are reflected in storage.
    return Object.assign(record, { state: instance.state, instance }) as Challenge;
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
      state: instance.state,
      privateState: instance.serialize(),
    };

    this.operators.set(id, instance);
    await this.storageAdapter.setChallenge(record);
    return this.toChallenge(record, instance);
  }

  async restoreChallenge(record: ChallengeRecord): Promise<Challenge> {
    const instance = this.instantiateChallenge(record);
    this.operators.set(record.id, instance);
    record.state = instance.state;
    await this.storageAdapter.setChallenge(record);
    return this.toChallenge(record, instance);
  }

  private isInviteFree(challenge: Challenge, invite: string): boolean {
    return !challenge.instance?.state?.players?.includes(invite);
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
    if (record) {
      const instance = this.getOrCreateOperator(record);
      return { success: true, data: this.toChallenge(record, instance) };
    }
    return {
      success: false,
      error: ChallengeError.NOT_FOUND,
      message: `Challenge not found for invite: ${invite}`,
    };
  }

  async getChallenge(challengeId: string): Promise<Challenge | undefined> {
    const record = await this.storageAdapter.getChallenge(challengeId);
    if (!record) {
      return undefined;
    }
    if (this.isChallengeStale(record)) {
      await this.deleteChallengeById(record.id);
      return undefined;
    }

    const instance = this.getOrCreateOperator(record);
    return this.toChallenge(record, instance);
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
      if (error instanceof ChallengeOperatorError) {
        return { error: error.message, code: error.code };
      }
      return { error: error instanceof Error ? error.message : String(error) };
    }
  }

  async getPlayerIdentities(challengeId: string): Promise<Record<string, string> | null> {
    const challenge = await this.getChallenge(challengeId);
    if (!challenge?.instance?.state?.gameEnded) return null;
    return challenge.instance.state.playerIdentities;
  }

  async resolvePlayerIdentity(challengeId: string, userIndex: number): Promise<string | null> {
    const challenge = await this.getChallenge(challengeId);
    return challenge?.instance?.state?.players?.[userIndex] ?? null;
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
