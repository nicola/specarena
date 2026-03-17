const STALE_CHALLENGE_TIMEOUT_MS = 10 * 60 * 1000;

import {
  Challenge,
  ChallengeError,
  ChallengeFactory,
  ChallengeMetadata,
  ChallengeOperator,
  ChallengeOperatorError,
  ChallengeOperatorState,
  GameCategory,
  Result,
  fromChallengeChannel,
  toChallengeChannel,
} from "./types";
import { ChatEngine, createChatEngine } from "./chat/ChatEngine";
import type { ArenaStorageAdapter, ChatStorageAdapter, UserStorageAdapter, PaginationOptions, ChallengeQueryOptions, PaginatedResult } from "./storage/types";
import { createStorage } from "./storage/createStorage";
import { ScoringModule } from "./scoring/index";
import type { GameResult } from "./scoring/types";

export interface EngineOptions {
  storageAdapter?: ArenaStorageAdapter;
  chatStorageAdapter?: ChatStorageAdapter;
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
    const defaults = (!options.storageAdapter || !options.userStorage || !options.chatStorageAdapter)
      ? createStorage()
      : undefined;
    this.storageAdapter = options.storageAdapter ?? defaults!.arena;
    this.users = options.userStorage ?? defaults!.user;
    this.challengeFactories = new Map<string, ChallengeFactory>();
    this.challengeOptions = new Map<string, Record<string, unknown>>();
    this.challengeMetadataMap = new Map<string, ChallengeMetadata>();
    this.scoring = options.scoring ?? null;
    const chatStorageAdapter = options.chatStorageAdapter ?? defaults?.chat;
    this.chat = options.chatEngine ?? createChatEngine({
      storageAdapter: chatStorageAdapter,
      isChannelRevealed: async (channel) => {
        const challengeId = fromChallengeChannel(channel);
        if (!challengeId) return false;
        const challenge = await this.getChallenge(challengeId);
        return challenge?.state?.status === "ended";
      },
      onChallengeEvent: async (challengeId, event) => {
        if (event.type !== "game_ended") return;
        const state = event.data;

        if (!this.scoring) return;
        // Use the state from the event payload directly rather than reading
        // from storage, since the operator may not have been persisted yet.
        const challenge = await this.getChallenge(challengeId);
        if (!challenge) return;
        const result: GameResult = {
          gameId: challenge.id,
          challengeType: challenge.challengeType,
          createdAt: challenge.createdAt,
          completedAt: state.completedAt ?? Date.now(),
          scores: state.scores,
          players: state.players,
          playerIdentities: state.playerIdentities,
          attributions: state.attributions,
        };
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

  private recreateOperator(challenge: Challenge): ChallengeOperator {
    const factory = this.challengeFactories.get(challenge.challengeType);
    if (!factory) {
      throw new Error(`Unknown challenge type: ${challenge.challengeType}`);
    }
    const options = this.challengeOptions.get(challenge.challengeType);
    const operator = factory(challenge.id, options, { messaging: this.chat });
    operator.restore(challenge);
    return operator;
  }

  private async persistOperator(challenge: Challenge, operator: ChallengeOperator): Promise<void> {
    const { gameState, state } = operator.serialize();
    challenge.gameState = gameState;
    challenge.state = state;

    // Classify game category when the game just ended
    if (state.status === "ended" && challenge.gameCategory === "train") {
      challenge.gameCategory = await this.computeGameCategory(state);
    }

    await this.storageAdapter.setChallenge(challenge);
  }

  private isChallengeStale(challenge: Challenge, now: number = Date.now()): boolean {
    const gameEnded = challenge.state?.status === "ended";
    const cutoff = now - STALE_CHALLENGE_TIMEOUT_MS;
    return !gameEnded && challenge.createdAt < cutoff;
  }

  async pruneStaleChallenges(now: number = Date.now()): Promise<number> {
    const { items: challenges } = await this.storageAdapter.listChallenges();
    const stale = challenges.filter((c) => this.isChallengeStale(c, now));
    if (stale.length === 0) return 0;

    await Promise.all(
      stale.flatMap((c) => [
        this.storageAdapter.deleteChallenge(c.id),
        this.chat.deleteChannel(c.id),
        this.chat.deleteChannel(toChallengeChannel(c.id)),
      ]),
    );

    return stale.length;
  }

  async listChallenges(options?: ChallengeQueryOptions): Promise<PaginatedResult<Challenge>> {
    return this.storageAdapter.listChallenges(options);
  }

  async createChallenge(challengeType: string): Promise<Challenge> {
    const id = crypto.randomUUID();
    const factory = this.challengeFactories.get(challengeType);

    if (!factory) {
      throw new Error(`Unknown challenge type: ${challengeType}`);
    }

    const options = this.challengeOptions.get(challengeType);
    const operator = factory(id, options, { messaging: this.chat });
    const { gameState, state } = operator.serialize();

    const metadata = this.getChallengeMetadata(challengeType);
    const playerCount = metadata?.players ?? 2;

    const challenge: Challenge = {
      id,
      name: challengeType,
      createdAt: Date.now(),
      challengeType,
      invites: Array.from({ length: playerCount }, () => `inv_${crypto.randomUUID()}`),
      gameState,
      state,
      gameCategory: "train",
    };

    await this.storageAdapter.setChallenge(challenge);
    return challenge;
  }

  private isInviteFree(challenge: Challenge, invite: string): boolean {
    return !challenge.state?.players?.includes(invite);
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
    const challenge = await this.storageAdapter.getChallenge(challengeId);
    if (!challenge) {
      return undefined;
    }
    if (!this.isChallengeStale(challenge)) {
      return challenge;
    }

    await Promise.all([
      this.storageAdapter.deleteChallenge(challenge.id),
      this.chat.deleteChannel(challenge.id),
      this.chat.deleteChannel(toChallengeChannel(challenge.id)),
    ]);
    
    return undefined;
  }

  async getChallengesByUserId(userId: string, options?: ChallengeQueryOptions): Promise<PaginatedResult<Challenge>> {
    return this.storageAdapter.getChallengesByUserId(userId, options);
  }

  async getChallengesByType(challengeType: string, options?: ChallengeQueryOptions): Promise<PaginatedResult<Challenge>> {
    return this.storageAdapter.getChallengesByType(challengeType, options);
  }

  async challengeJoin(invite: string, userId?: string) {
    const result = await this.getChallengeFromInvite(invite);

    if (!result.success) {
      return { error: result.message };
    }

    const challenge = result.data;
    const operator = this.recreateOperator(challenge);

    try {
      await operator.join(invite, userId);
    } catch (error) {
      if (error instanceof ChallengeOperatorError) {
        return { error: error.message, code: error.code };
      }
      return { error: error instanceof Error ? error.message : String(error) };
    }

    await this.persistOperator(challenge, operator);

    const metadata = this.getChallengeMetadata(challenge.challengeType);
    return {
      ChallengeID: challenge.id,
      ChallengeInfo: metadata,
    };
  }

  async challengeMessage(challengeId: string, from: string, messageType: string, content: string) {
    const challenge = await this.getChallenge(challengeId);

    if (!challenge) {
      return { error: "Challenge not found" };
    }

    await this.chat.sendChallengeMessage(challengeId, from, (messageType ? `(${messageType}) ` : "") + content, "operator");

    const operator = this.recreateOperator(challenge);

    try {
      await operator.message({
        channel: challengeId,
        from,
        type: messageType,
        content,
        timestamp: Date.now(),
      });
    } catch (error) {
      if (error instanceof ChallengeOperatorError) {
        return { error: error.message, code: error.code };
      }
      return { error: error instanceof Error ? error.message : String(error) };
    }

    await this.persistOperator(challenge, operator);
    return { ok: "Message sent" };
  }

  private async computeGameCategory(state: ChallengeOperatorState): Promise<GameCategory> {
    const userIds = Object.values(state.playerIdentities).filter(Boolean);
    if (userIds.length === 0) return "train";

    const profiles = await this.users.getUsers(userIds);
    const nonBenchmarkCount = userIds.filter((id) => !profiles[id]?.isBenchmark).length;

    if (nonBenchmarkCount === 0) return "benchmark";
    if (nonBenchmarkCount === 1) return "test";
    return "train";
  }

  async getPlayerIdentities(challengeId: string): Promise<Record<string, string> | null> {
    const challenge = await this.getChallenge(challengeId);
    if (!challenge?.state || challenge.state.status !== "ended") return null;
    return challenge.state.playerIdentities;
  }

  async resolvePlayerIdentity(challengeId: string, userIndex: number): Promise<string | null> {
    const challenge = await this.getChallenge(challengeId);
    return challenge?.state?.players?.[userIndex] ?? null;
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
export type { ArenaStorageAdapter, ChatStorageAdapter, UserStorageAdapter, UserProfile, PaginationOptions, ChallengeQueryOptions, PaginatedResult } from "./storage/types";
export { InMemoryArenaStorageAdapter } from "./storage/InMemoryArenaStorageAdapter";
export { InMemoryChatStorageAdapter } from "./storage/InMemoryChatStorageAdapter";
export { InMemoryUserStorageAdapter } from "./users/index";
export { createStorage } from "./storage/createStorage";
