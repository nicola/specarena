import { ChatMessage } from "../types";
import { ChatStorageAdapter, InMemoryChatStorageAdapter } from "../storage/InMemoryChatStorageAdapter";

export interface ChatEngineOptions {
  storageAdapter?: ChatStorageAdapter;
}

interface ChannelSubscriber {
  controller: ReadableStreamDefaultController;
  viewer: string | null;
}

export class ChatEngine {
  private readonly storageAdapter: ChatStorageAdapter;
  // TODO in the future separate to another service and persist this on db
  private readonly channelSubscribers: Map<string, Set<ChannelSubscriber>>;

  constructor(options: ChatEngineOptions = {}) {
    this.storageAdapter = options.storageAdapter ?? new InMemoryChatStorageAdapter();
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
    return this.getMessagesForChannel(`challenge_${challengeId}`);
  }

  async getMessagesForChannel(channel: string): Promise<ChatMessage[]> {
    return this.storageAdapter.getMessagesForChannel(channel);
  }

  private filterVisibleMessages(messages: ChatMessage[], from: string, index: number): ChatMessage[] {
    return messages.filter((msg: ChatMessage) =>
      msg.index !== undefined && msg.index >= index && (!msg.to || msg.to === from || msg.from === from));
  }

  private redactMessage(msg: ChatMessage): ChatMessage {
    return { ...msg, content: "", redacted: true };
  }

  syncRedacted(_channel: string, viewer: string | null, index: number, messages: ChatMessage[]): { messages: ChatMessage[]; count: number } {
    const result = messages
      .filter((msg) => msg.index !== undefined && msg.index >= index)
      .map((msg) => {
        if (!msg.to) return msg;
        if (viewer && (msg.to === viewer || msg.from === viewer)) return msg;
        return this.redactMessage(msg);
      });
    return { messages: result, count: result.length };
  }

  async challengeSyncRedacted(challengeId: string, viewer: string | null, index: number) {
    const channel = `challenge_${challengeId}`;
    const messages = await this.getMessagesForChannel(channel);
    return this.syncRedacted(channel, viewer, index, messages);
  }

  private async syncChannel(channel: string, from: string, index: number) {
    const messages = await this.getMessagesForChannel(channel);
    const filteredMessages = this.filterVisibleMessages(messages, from, index);
    return {
      messages: filteredMessages,
      count: filteredMessages.length,
    };
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

  private notifyChannelSubscribers(channel: string, message: ChatMessage): void {
    const subscribers = this.channelSubscribers.get(channel);
    if (!subscribers) {
      return;
    }

    const deadSubscribers: ChannelSubscriber[] = [];

    subscribers.forEach((sub) => {
      let msgToSend = message;
      if (message.to) {
        const viewer = sub.viewer;
        if (!viewer || (message.to !== viewer && message.from !== viewer)) {
          msgToSend = this.redactMessage(message);
        }
      }
      const data = JSON.stringify({ type: "new_message", message: msgToSend });
      const encoded = `data: ${data}\n\n`;
      try {
        sub.controller.enqueue(new TextEncoder().encode(encoded));
      } catch {
        deadSubscribers.push(sub);
      }
    });

    deadSubscribers.forEach((sub) => subscribers.delete(sub));
    if (subscribers.size === 0) {
      this.channelSubscribers.delete(channel);
    }
  }

  async sendChallengeMessage(challengeId: string, from: string, content: string, to?: string | null): Promise<ChatMessage> {
    return this.sendMessage(`challenge_${challengeId}`, from, content, to);
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

  async chatSync(channel: string, from: string, index: number) {
    return this.syncChannel(channel, from, index);
  }

  async challengeSync(challengeId: string, from: string, index: number) {
    return this.syncChannel(`challenge_${challengeId}`, from, index);
  }
}

export function createChatEngine(options: ChatEngineOptions = {}): ChatEngine {
  return new ChatEngine(options);
}

export const defaultChatEngine = createChatEngine();
