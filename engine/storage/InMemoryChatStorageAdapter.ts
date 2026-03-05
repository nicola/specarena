import type { ChatMessage } from "../types";
import type { ChatStorageAdapter } from "./types";

export type { ChatStorageAdapter } from "./types";

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

  async appendMessage(channel: string, message: ChatMessage): Promise<void> {
    if (!this.messagesByChannel[channel]) {
      this.messagesByChannel[channel] = [];
    }
    this.messagesByChannel[channel].push(message);
  }

  async deleteChannel(channel: string): Promise<void> {
    delete this.messagesByChannel[channel];
    delete this.indexCounters[channel];
  }
}
