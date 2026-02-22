import { ChatMessage } from "../types";
import { ChatStorageAdapter, InMemoryChatStorageAdapter } from "../storage/InMemoryChatStorageAdapter";

export interface ChatEngineOptions {
  storageAdapter?: ChatStorageAdapter;
}

export class ChatEngine {
  private readonly storageAdapter: ChatStorageAdapter;
  // TODO in the future separate to another service and persist this on db
  private readonly channelSubscribers: Map<string, Set<ReadableStreamDefaultController>>;

  constructor(options: ChatEngineOptions = {}) {
    this.storageAdapter = options.storageAdapter ?? new InMemoryChatStorageAdapter();
    this.channelSubscribers = new Map<string, Set<ReadableStreamDefaultController>>();
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

  private async syncChannel(channel: string, from: string, index: number) {
    const messages = await this.getMessagesForChannel(channel);
    const filteredMessages = this.filterVisibleMessages(messages, from, index);
    return {
      messages: filteredMessages,
      count: filteredMessages.length,
    };
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

  private notifyChannelSubscribers(channel: string, message: ChatMessage): void {
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

  async syncChannelWithRedaction(channel: string, authenticatedUser: string, index: number) {
    const messages = await this.getMessagesForChannel(channel);
    const filtered = messages.filter((msg) => msg.index !== undefined && msg.index >= index);
    const redacted = filtered.map((msg) => {
      if (msg.to && msg.to !== authenticatedUser) {
        return { ...msg, content: "[redacted]", redacted: true };
      }
      return msg;
    });
    return { messages: redacted, count: redacted.length };
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
