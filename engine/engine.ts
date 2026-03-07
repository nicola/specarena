const STALE_CHALLENGE_TIMEOUT_MS = 10 * 60 * 1000;

import {
  Challenge,
  ChallengeError,
  ChallengeFactory,
  ChallengeMetadata,
  ChallengeOperator,
  ChallengeOperatorError,
  Result,
  fromChallengeChannel,
  toChallengeChannel,
} from "./types";
import { ChatEngine, createChatEngine } from "./chat/ChatEngine";
import { ArenaStorageAdapter, InMemoryArenaStorageAdapter } from "./storage/InMemoryArenaStorageAdapter";
import { ScoringModule } from "./scoring/index";
import type { GameResult } from "./scoring/types";
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
        const challenge = await this.getChallenge(challengeId);
        return challenge?.state?.gameEnded ?? false;
      },
      onChallengeEvent: async (challengeId, event) => {
        if (event.type !== "game_ended" || !this.scoring) return;
        // Use the state from the event payload directly rather than reading
        // from storage, since the operator may not have been persisted yet.
        const challenge = await this.getChallenge(challengeId);
        if (!challenge) return;
        const state = event.data;
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
    await this.storageAdapter.setChallenge(challenge);
  }

  private isChallengeStale(challenge: Challenge, now: number = Date.now()): boolean {
    const gameEnded = challenge.state?.gameEnded ?? false;
    const cutoff = now - STALE_CHALLENGE_TIMEOUT_MS;
    return !gameEnded && challenge.createdAt < cutoff;
  }

  async pruneStaleChallenges(now: number = Date.now()): Promise<number> {
    const challenges = await this.storageAdapter.listChallenges();
    const stale = challenges.filter((challenge) => this.isChallengeStale(challenge, now));
    if (stale.length === 0) {
      return 0;
    }

    await Promise.all(
      stale.map(async (challenge) => {
        await this.storageAdapter.deleteChallenge(challenge.id);
        await this.chat.deleteChannel(challenge.id);
        await this.chat.deleteChannel(toChallengeChannel(challenge.id));
      }),
    );

    return stale.length;
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
    const operator = factory(id, options, { messaging: this.chat });
    const { gameState, state } = operator.serialize();

    const challenge: Challenge = {
      id,
      name: challengeType,
      createdAt: Date.now(),
      challengeType,
      invites: [`inv_${crypto.randomUUID()}`, `inv_${crypto.randomUUID()}`],
      gameState,
      state,
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

  async getChallengesByUserId(userId: string): Promise<Challenge[]> {
    return this.storageAdapter.getChallengesByUserId(userId);
  }

  async getChallengesByType(challengeType: string): Promise<Challenge[]> {
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

    await this.chat.sendChallengeMessage(challengeId, from, (messageType ? `(${messageType}) ` : "") + content, "operator");

    if (!challenge) {
      return { error: "Challenge not found" };
    }

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

  async getPlayerIdentities(challengeId: string): Promise<Record<string, string> | null> {
    const challenge = await this.getChallenge(challengeId);
    if (!challenge?.state?.gameEnded) return null;
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
export { ArenaStorageAdapter, InMemoryArenaStorageAdapter } from "./storage/InMemoryArenaStorageAdapter";
export { ChatStorageAdapter, InMemoryChatStorageAdapter } from "./storage/InMemoryChatStorageAdapter";
export { UserProfile, UserStorageAdapter, InMemoryUserStorageAdapter } from "./users/index";
