const STALE_CHALLENGE_TIMEOUT_MS = 10 * 60 * 1000;

import {
  ActiveChallenge,
  Challenge,
  ChallengeError,
  ChallengeFactory,
  ChallengeMetadata,
  ChallengeOperatorError,
  ChallengeOperatorState,
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
  private readonly challengeRuntimes: Map<string, ActiveChallenge>;
  readonly chat: ChatEngine;
  scoring: ScoringModule | null;

  constructor(options: EngineOptions = {}) {
    this.storageAdapter = options.storageAdapter ?? new InMemoryArenaStorageAdapter();
    this.users = options.userStorage ?? new InMemoryUserStorageAdapter();
    this.challengeFactories = new Map<string, ChallengeFactory>();
    this.challengeOptions = new Map<string, Record<string, unknown>>();
    this.challengeMetadataMap = new Map<string, ChallengeMetadata>();
    this.challengeRuntimes = new Map<string, ActiveChallenge>();
    this.scoring = options.scoring ?? null;
    this.chat = options.chatEngine ?? createChatEngine({
      isChannelRevealed: async (channel) => {
        const challengeId = fromChallengeChannel(channel);
        if (!challengeId) return false;
        const challenge = await this.getChallenge(challengeId);
        return challenge?.state.gameEnded ?? false;
      },
      onChallengeEvent: async (challengeId, event) => {
        if (event.type !== "game_ended" || !this.scoring) return;
        const runtime = this.challengeRuntimes.get(challengeId);
        if (!runtime) return;
        const challenge = this.snapshotChallenge(runtime);
        await this.storageAdapter.setChallenge(challenge);
        const result = ScoringModule.challengeToGameResult(challenge);
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
    this.challengeRuntimes.clear();
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

  private isChallengeStale(challenge: Challenge, now: number = Date.now()): boolean {
    const cutoff = now - STALE_CHALLENGE_TIMEOUT_MS;
    return !challenge.state.gameEnded && challenge.createdAt < cutoff;
  }

  private cloneChallengeState(state: ChallengeOperatorState): ChallengeOperatorState {
    return structuredClone(state);
  }

  private snapshotChallenge(runtime: ActiveChallenge): Challenge {
    const persistedState = runtime.instance.serializeState?.();
    return {
      id: runtime.id,
      name: runtime.name,
      createdAt: runtime.createdAt,
      challengeType: runtime.challengeType,
      invites: [...runtime.invites],
      playerCount: runtime.instance.playerCount,
      state: this.cloneChallengeState(runtime.instance.state),
      persistedState: persistedState === undefined ? undefined : structuredClone(persistedState),
    };
  }

  private async deleteChallengeArtifacts(challengeId: string): Promise<void> {
    await this.storageAdapter.deleteChallenge(challengeId);
    this.challengeRuntimes.delete(challengeId);
    await this.chat.deleteChannel(challengeId);
    await this.chat.deleteChannel(toChallengeChannel(challengeId));
  }

  async pruneStaleChallenges(now: number = Date.now()): Promise<number> {
    const challenges = await this.storageAdapter.listChallenges();
    const stale = challenges.filter((challenge) => this.isChallengeStale(challenge, now));
    if (stale.length === 0) {
      return 0;
    }

    await Promise.all(
      stale.map(async (challenge) => {
        await this.deleteChallengeArtifacts(challenge.id);
      }),
    );

    return stale.length;
  }

  async listChallenges(): Promise<Challenge[]> {
    const challenges = await this.storageAdapter.listChallenges();
    const visible: Challenge[] = [];

    for (const challenge of challenges) {
      if (this.isChallengeStale(challenge)) {
        await this.deleteChallengeArtifacts(challenge.id);
        continue;
      }
      visible.push(challenge);
    }

    return visible.sort((a, b) => b.createdAt - a.createdAt);
  }

  async createChallenge(challengeType: string): Promise<Challenge> {
    const id = crypto.randomUUID();
    const factory = this.challengeFactories.get(challengeType);

    if (!factory) {
      throw new Error(`Unknown challenge type: ${challengeType}`);
    }

    const options = this.challengeOptions.get(challengeType);
    const instance = factory(id, options, { messaging: this.chat });

    const runtime: ActiveChallenge = {
      id,
      name: challengeType,
      createdAt: Date.now(),
      challengeType,
      invites: [`inv_${crypto.randomUUID()}`, `inv_${crypto.randomUUID()}`],
      instance,
    };

    this.challengeRuntimes.set(id, runtime);
    const challenge = this.snapshotChallenge(runtime);
    await this.storageAdapter.setChallenge(challenge);
    return challenge;
  }

  private isInviteFree(challenge: Challenge, invite: string): boolean {
    return !challenge.state.players.includes(invite);
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
    const challenge = await this.storageAdapter.getChallengeFromInvite(invite);
    if (challenge && !this.isChallengeStale(challenge)) {
      return { success: true, data: challenge };
    }
    if (challenge) {
      await this.deleteChallengeArtifacts(challenge.id);
    }
    return {
      success: false,
      error: ChallengeError.NOT_FOUND,
      message: `Challenge not found for invite: ${invite}`,
    };
  }

  async getChallenge(challengeId: string): Promise<Challenge | undefined> {
    const challenge = await this.storageAdapter.getChallenge(challengeId);
    if (!challenge) {
      return undefined;
    }
    if (!this.isChallengeStale(challenge)) {
      return challenge;
    }

    await this.storageAdapter.deleteChallenge(challenge.id);
    this.challengeRuntimes.delete(challenge.id);
    await this.chat.deleteChannel(challenge.id);
    await this.chat.deleteChannel(toChallengeChannel(challenge.id));
    return undefined;
  }

  async getChallengesByUserId(userId: string): Promise<Challenge[]> {
    return (await this.listChallenges())
      .filter((challenge) => Object.values(challenge.state.playerIdentities).includes(userId));
  }

  async getChallengesByType(challengeType: string): Promise<Challenge[]> {
    return (await this.listChallenges())
      .filter((c) => c.challengeType === challengeType);
  }

  async challengeJoin(invite: string, userId?: string) {
    const result = await this.getChallengeFromInvite(invite);

    if (!result.success) {
      return { error: result.message };
    }

    const challenge = result.data;
    const runtime = this.challengeRuntimes.get(challenge.id);
    if (!runtime) {
      return { error: "Challenge runtime not found" };
    }

    try {
      await runtime.instance.join(invite, userId);
      await this.storageAdapter.setChallenge(this.snapshotChallenge(runtime));
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
    const runtime = this.challengeRuntimes.get(challengeId);

    if (!challenge || !runtime) {
      return { error: "Challenge not found" };
    }

    await this.chat.sendChallengeMessage(challengeId, from, (messageType ? `(${messageType}) ` : "") + content, "operator");

    try {
      await runtime.instance.message({
        channel: challengeId,
        from,
        type: messageType,
        content,
        timestamp: Date.now(),
      });
      await this.storageAdapter.setChallenge(this.snapshotChallenge(runtime));
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
    if (!challenge?.state.gameEnded) return null;
    return challenge.state.playerIdentities;
  }

  async resolvePlayerInvite(challengeId: string, userIndex: number): Promise<string | null> {
    const challenge = await this.getChallenge(challengeId);
    return challenge?.state.players?.[userIndex] ?? null;
  }

  async resolvePlayerIdentity(challengeId: string, userIndex: number): Promise<string | null> {
    return this.resolvePlayerInvite(challengeId, userIndex);
  }

  getRuntimeChallenge(challengeId: string): ActiveChallenge | undefined {
    return this.challengeRuntimes.get(challengeId);
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
