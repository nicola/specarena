import { ChatMessage } from "../types";

export interface ChatStorageAdapter {
  clearRuntimeState(): Promise<void>;
  getMessagesForChannel(channel: string): Promise<ChatMessage[]>;
  appendMessage(channel: string, message: Omit<ChatMessage, "index">): Promise<ChatMessage>;
  deleteChannel(channel: string): Promise<void>;
}

export class InMemoryChatStorageAdapter implements ChatStorageAdapter {
  private messagesByChannel: Record<string, ChatMessage[]> = {};
  private indexCounters: Record<string, number> = {};

  async clearRuntimeState(): Promise<void> {
    this.messagesByChannel = {};
    this.indexCounters = {};
  }

  async getMessagesForChannel(channel: string): Promise<ChatMessage[]> {
    return [...(this.messagesByChannel[channel] ?? [])];
  }

  async appendMessage(channel: string, message: Omit<ChatMessage, "index">): Promise<ChatMessage> {
    if (!this.messagesByChannel[channel]) {
      this.messagesByChannel[channel] = [];
    }
    const current = this.indexCounters[channel] ?? 0;
    const index = current + 1;
    this.indexCounters[channel] = index;

    const storedMessage: ChatMessage = { ...message, index };
    this.messagesByChannel[channel].push(storedMessage);
    return storedMessage;
  }

  async deleteChannel(channel: string): Promise<void> {
    delete this.messagesByChannel[channel];
    delete this.indexCounters[channel];
  }
}
