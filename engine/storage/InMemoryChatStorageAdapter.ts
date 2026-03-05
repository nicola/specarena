import { ChatMessage } from "../types";

export interface ChatStorageAdapter {
  clearRuntimeState(): Promise<void>;
  getNextIndex(channel: string): Promise<number>;
  getMessagesForChannel(channel: string): Promise<ChatMessage[]>;
  appendMessage(channel: string, message: ChatMessage): Promise<ChatMessage>;
  deleteChannel(channel: string): Promise<void>;
}

export class InMemoryChatStorageAdapter implements ChatStorageAdapter {
  private messagesByChannel: Record<string, ChatMessage[]> = {};
  private indexCounters: Record<string, number> = {};

  async clearRuntimeState(): Promise<void> {
    this.messagesByChannel = {};
    this.indexCounters = {};
  }

  async getNextIndex(channel: string): Promise<number> {
    const current = this.indexCounters[channel] ?? 0;
    const next = current + 1;
    this.indexCounters[channel] = next;
    return next;
  }

  async getMessagesForChannel(channel: string): Promise<ChatMessage[]> {
    return [...(this.messagesByChannel[channel] ?? [])];
  }

  async appendMessage(channel: string, message: ChatMessage): Promise<ChatMessage> {
    if (!this.messagesByChannel[channel]) {
      this.messagesByChannel[channel] = [];
    }
    if (message.index === undefined) {
      message.index = await this.getNextIndex(channel);
    }
    this.messagesByChannel[channel].push(message);
    return message;
  }

  async deleteChannel(channel: string): Promise<void> {
    delete this.messagesByChannel[channel];
    delete this.indexCounters[channel];
  }
}
