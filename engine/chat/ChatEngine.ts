import { ChallengeOperatorEvent, ChatMessage, toChallengeChannel } from "../types";
import { ChatStorageAdapter, InMemoryChatStorageAdapter } from "../storage/InMemoryChatStorageAdapter";

const encoder = new TextEncoder();

export interface ChatEngineOptions {
  storageAdapter?: ChatStorageAdapter;
  isChannelRevealed?: (channel: string) => Promise<boolean>;
  onChallengeEvent?: (challengeId: string, event: ChallengeOperatorEvent) => void | Promise<void>;
}

interface ChannelSubscriber {
  controller: ReadableStreamDefaultController;
  viewer: string | null;
}

export class ChatEngine {
  private readonly storageAdapter: ChatStorageAdapter;
  private readonly isChannelRevealed?: (channel: string) => Promise<boolean>;
  private readonly onChallengeEvent?: (challengeId: string, event: ChallengeOperatorEvent) => void | Promise<void>;
  // TODO in the future separate to another service and persist this on db
  private readonly channelSubscribers: Map<string, Set<ChannelSubscriber>>;

  constructor(options: ChatEngineOptions = {}) {
    this.storageAdapter = options.storageAdapter ?? new InMemoryChatStorageAdapter();
    this.isChannelRevealed = options.isChannelRevealed;
    this.onChallengeEvent = options.onChallengeEvent;
    this.channelSubscribers = new Map<string, Set<ChannelSubscriber>>();
  }

  async clearRuntimeState(): Promise<void> {
    await this.storageAdapter.clearRuntimeState();
    this.channelSubscribers.clear();
  }

  async getNextIndex(channel: string): Promise<number> {
    return this.storageAdapter.getNextIndex(channel);
  }

  async getMessagesForChallengeChannel(challengeId: string): Promise<ChatMessage[]> {
    return this.getMessagesForChannel(toChallengeChannel(challengeId));
  }

  async getMessagesForChannel(channel: string): Promise<ChatMessage[]> {
    return this.storageAdapter.getMessagesForChannel(channel);
  }

  async deleteChannel(channel: string): Promise<void> {
    await this.storageAdapter.deleteChannel(channel);
    this.channelSubscribers.delete(channel);
  }

  private redactMessage(msg: ChatMessage): ChatMessage {
    return { ...msg, content: "", redacted: true };
  }

  private async syncChannel(channel: string, viewer: string | null, index: number) {
    const messages = await this.getMessagesForChannel(channel);
    const revealed = (await this.isChannelRevealed?.(channel)) ?? false;
    const result = messages
      .filter((msg) => msg.index !== undefined && msg.index >= index)
      .map((msg) => {
        if (revealed) return msg;
        if (!msg.to) return msg;
        if (viewer && (msg.to === viewer || msg.from === viewer)) return msg;
        return this.redactMessage(msg);
      });
    return { messages: result, count: result.length };
  }

  subscribeToChannel(channel: string, controller: ReadableStreamDefaultController, viewer?: string | null): () => void {
    if (!this.channelSubscribers.has(channel)) {
      this.channelSubscribers.set(channel, new Set());
    }
    const subscriber: ChannelSubscriber = { controller, viewer: viewer ?? null };
    this.channelSubscribers.get(channel)!.add(subscriber);

    return () => {
      const subscribers = this.channelSubscribers.get(channel);
      if (!subscribers) {
        return;
      }
      subscribers.delete(subscriber);
      if (subscribers.size === 0) {
        this.channelSubscribers.delete(channel);
      }
    };
  }

  private sendToSubscribers(channel: string, fn: (sub: ChannelSubscriber) => void): void {
    const subscribers = this.channelSubscribers.get(channel);
    if (!subscribers) return;

    const dead: ChannelSubscriber[] = [];
    subscribers.forEach((sub) => {
      try { fn(sub); } catch { dead.push(sub); }
    });
    for (const sub of dead) subscribers.delete(sub);
    if (subscribers.size === 0) this.channelSubscribers.delete(channel);
  }

  private notifyChannelSubscribers(channel: string, message: ChatMessage): void {
    this.sendToSubscribers(channel, (sub) => {
      let msgToSend = message;
      if (message.to) {
        const viewer = sub.viewer;
        if (!viewer || (message.to !== viewer && message.from !== viewer)) {
          msgToSend = this.redactMessage(message);
        }
      }
      const data = JSON.stringify({ type: "new_message", message: msgToSend });
      sub.controller.enqueue(encoder.encode(`data: ${data}\n\n`));
    });
  }

  broadcastEvent(channel: string, event: Record<string, unknown>): void {
    const bytes = encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
    this.sendToSubscribers(channel, (sub) => {
      sub.controller.enqueue(bytes);
    });
  }

  broadcastChallengeEvent(challengeId: string, event: ChallengeOperatorEvent): void {
    this.broadcastEvent(challengeId, event);
    this.broadcastEvent(toChallengeChannel(challengeId), event);
    this.onChallengeEvent?.(challengeId, event);
  }

  async sendChallengeMessage(challengeId: string, from: string, content: string, to?: string | null): Promise<ChatMessage> {
    return this.sendMessage(toChallengeChannel(challengeId), from, content, to);
  }

  async sendMessage(channel: string, from: string, content: string, to?: string | null): Promise<ChatMessage> {
    const index = await this.storageAdapter.getNextIndex(channel);
    const message: ChatMessage = {
      channel,
      from,
      to,
      content: content || "",
      index,
      timestamp: Date.now(),
    };

    await this.storageAdapter.appendMessage(channel, message);
    this.notifyChannelSubscribers(channel, message);
    return message;
  }

  async chatSend(channel: string, from: string, content: string, to?: string | null) {
    const message = await this.sendMessage(channel, from, content, to);
    return { index: message.index, channel, from, to: to ?? null };
  }

  async chatSync(channel: string, viewer: string | null, index: number) {
    return this.syncChannel(channel, viewer, index);
  }

  async challengeSync(challengeId: string, viewer: string | null, index: number) {
    return this.syncChannel(toChallengeChannel(challengeId), viewer, index);
  }
}

export function createChatEngine(options: ChatEngineOptions = {}): ChatEngine {
  return new ChatEngine(options);
}

export const defaultChatEngine = createChatEngine();
