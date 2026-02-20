import { v4 as uuidv4 } from "uuid";
import {
  Challenge,
  ChallengeError,
  ChallengeFactory,
  ChallengeMetadata,
  ChatMessage,
  Result,
} from "./types";

export interface EngineStorage {
  messagesByChannel?: Map<string, ChatMessage[]>;
  indexCounters?: Map<string, number>;
  channelSubscribers?: Map<string, Set<ReadableStreamDefaultController>>;
  challenges?: Map<string, Challenge>;
  challengeFactories?: Map<string, ChallengeFactory>;
  challengeOptions?: Map<string, Record<string, unknown>>;
  challengeMetadataMap?: Map<string, ChallengeMetadata>;
}

export interface EngineOptions {
  storage?: EngineStorage;
}

export class ArenaEngine {
  readonly messagesByChannel: Map<string, ChatMessage[]>;
  readonly indexCounters: Map<string, number>;
  readonly channelSubscribers: Map<string, Set<ReadableStreamDefaultController>>;
  readonly challenges: Map<string, Challenge>;
  private readonly challengeFactories: Map<string, ChallengeFactory>;
  private readonly challengeOptions: Map<string, Record<string, unknown>>;
  private readonly challengeMetadataMap: Map<string, ChallengeMetadata>;

  constructor(options: EngineOptions = {}) {
    const storage = options.storage ?? {};
    this.messagesByChannel = storage.messagesByChannel ?? new Map<string, ChatMessage[]>();
    this.indexCounters = storage.indexCounters ?? new Map<string, number>();
    this.channelSubscribers = storage.channelSubscribers ?? new Map<string, Set<ReadableStreamDefaultController>>();
    this.challenges = storage.challenges ?? new Map<string, Challenge>();
    this.challengeFactories = storage.challengeFactories ?? new Map<string, ChallengeFactory>();
    this.challengeOptions = storage.challengeOptions ?? new Map<string, Record<string, unknown>>();
    this.challengeMetadataMap = storage.challengeMetadataMap ?? new Map<string, ChallengeMetadata>();
  }

  clearRuntimeState(): void {
    this.challenges.clear();
    this.messagesByChannel.clear();
    this.indexCounters.clear();
    this.channelSubscribers.clear();
  }

  getNextIndex(channel: string): number {
    const current = this.indexCounters.get(channel) ?? 0;
    const next = current + 1;
    this.indexCounters.set(channel, next);
    return next;
  }

  getMessagesForChallengeChannel(challengeId: string): ChatMessage[] {
    return this.messagesByChannel.get(`challenge_${challengeId}`) ?? [];
  }

  getMessagesForChannel(channel: string): ChatMessage[] {
    return this.messagesByChannel.get(channel) ?? [];
  }

  subscribeToChannel(channel: string, controller: ReadableStreamDefaultController): () => void {
    if (!this.channelSubscribers.has(channel)) {
      this.channelSubscribers.set(channel, new Set());
    }
    this.channelSubscribers.get(channel)!.add(controller);

    return () => {
      const subscribers = this.channelSubscribers.get(channel);
      if (!subscribers) {
        return;
      }
      subscribers.delete(controller);
      if (subscribers.size === 0) {
        this.channelSubscribers.delete(channel);
      }
    };
  }

  notifyChannelSubscribers(channel: string, message: ChatMessage): void {
    const subscribers = this.channelSubscribers.get(channel);
    if (!subscribers) {
      return;
    }

    const data = JSON.stringify({ type: "new_message", message });
    const messageToSend = `data: ${data}\n\n`;
    const deadConnections: ReadableStreamDefaultController[] = [];

    subscribers.forEach((controller) => {
      try {
        controller.enqueue(new TextEncoder().encode(messageToSend));
      } catch {
        deadConnections.push(controller);
      }
    });

    deadConnections.forEach((controller) => subscribers.delete(controller));
    if (subscribers.size === 0) {
      this.channelSubscribers.delete(channel);
    }
  }

  sendChallengeMessage(challengeId: string, from: string, content: string, to?: string | null): ChatMessage {
    return this.sendMessage(`challenge_${challengeId}`, from, content, to);
  }

  sendMessage(channel: string, from: string, content: string, to?: string | null): ChatMessage {
    const index = this.getNextIndex(channel);
    const message: ChatMessage = {
      channel,
      from,
      to,
      content: content || "",
      index,
      timestamp: Date.now(),
    };

    if (!this.messagesByChannel.has(channel)) {
      this.messagesByChannel.set(channel, []);
    }
    this.messagesByChannel.get(channel)!.push(message);
    this.notifyChannelSubscribers(channel, message);
    return message;
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

  createChallenge(challengeType: string): Challenge {
    const id = crypto.randomUUID();
    const factory = this.challengeFactories.get(challengeType);

    if (!factory) {
      throw new Error(`Unknown challenge type: ${challengeType}`);
    }

    const options = this.challengeOptions.get(challengeType);
    const instance = factory(id, options, {
      messaging: {
        sendMessage: this.sendMessage.bind(this),
        sendChallengeMessage: this.sendChallengeMessage.bind(this),
      },
    });

    const challenge: Challenge = {
      id,
      name: challengeType,
      createdAt: Date.now(),
      challengeType,
      invites: [`inv_${uuidv4()}`, `inv_${uuidv4()}`],
      instance,
    };

    this.challenges.set(id, challenge);
    return challenge;
  }

  private isInviteFree(challenge: Challenge, invite: string): boolean {
    return !challenge.instance?.state?.players?.includes(invite);
  }

  filterValidInvites(_invites: string[]): string[] {
    return [];
  }

  getInvite(invite: string): Result<Challenge> {
    const result = this.getChallengeFromInvite(invite);
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

  getChallengeFromInvite(invite: string): Result<Challenge> {
    const challenge = Array.from(this.challenges.values()).find((c) => c.invites.includes(invite));
    if (challenge) {
      return { success: true, data: challenge };
    }
    return {
      success: false,
      error: ChallengeError.NOT_FOUND,
      message: `Challenge not found for invite: ${invite}`,
    };
  }

  getChallenge(challengeId: string): Challenge | undefined {
    return this.challenges.get(challengeId);
  }

  getChallengesByType(challengeType: string): Challenge[] {
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    return Array.from(this.challenges.values())
      .filter((c) => c.challengeType === challengeType)
      .filter((c) => {
        const gameStarted = c.instance?.state?.gameStarted ?? false;
        const createdMoreThan10MinsAgo = c.createdAt < tenMinutesAgo;
        return gameStarted || !createdMoreThan10MinsAgo;
      })
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  challengeJoin(invite: string) {
    const result = this.getChallengeFromInvite(invite);

    if (!result.success) {
      return { error: result.message };
    }

    const challenge = result.data;

    try {
      challenge.instance.join(invite);
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }

    const metadata = this.getChallengeMetadata(challenge.challengeType);
    return {
      ChallengeID: challenge.id,
      ChallengeInfo: metadata,
    };
  }

  challengeMessage(challengeId: string, from: string, messageType: string, content: string) {
    const challenge = this.getChallenge(challengeId);

    this.sendChallengeMessage(challengeId, from, (messageType ? `(${messageType}) ` : "") + content, "operator");

    if (!challenge || !challenge.instance) {
      return { error: "Challenge not found" };
    }

    try {
      challenge.instance.message({
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

  challengeSync(channel: string, from: string, index: number) {
    const messages = this.getMessagesForChallengeChannel(channel);
    const filteredMessages = messages.filter((msg: ChatMessage) =>
      msg.index !== undefined && msg.index >= index && (!msg.to || msg.to === from || msg.from === from)
    );

    return {
      messages: filteredMessages,
      count: filteredMessages.length,
    };
  }

  chatSend(channel: string, from: string, content: string, to?: string | null) {
    const message = this.sendMessage(channel, from, content, to);
    return { index: message.index, channel, from, to: to ?? null };
  }

  chatSync(channel: string, from: string, index: number) {
    const messages = this.getMessagesForChannel(channel);
    const filteredMessages = messages.filter((msg: ChatMessage) =>
      msg.index !== undefined && msg.index >= index && (!msg.to || msg.to === from || msg.from === from)
    );

    return {
      messages: filteredMessages,
      count: filteredMessages.length,
    };
  }
}

export function createEngine(options: EngineOptions = {}): ArenaEngine {
  return new ArenaEngine(options);
}

export const defaultEngine = createEngine();

