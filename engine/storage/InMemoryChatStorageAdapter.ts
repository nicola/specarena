import { ChatMessage } from "../types";
import type { ChatStorageAdapter } from "./types";

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
    const current = this.indexCounters[channel] ?? 0;
    const index = current + 1;
    this.indexCounters[channel] = index;

    const stored: ChatMessage = { ...message, index };
    if (!this.messagesByChannel[channel]) {
      this.messagesByChannel[channel] = [];
    }
    this.messagesByChannel[channel].push(stored);
    return stored;
  }

  async deleteChannel(channel: string): Promise<void> {
    delete this.messagesByChannel[channel];
    delete this.indexCounters[channel];
  }
}
