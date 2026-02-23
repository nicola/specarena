import { ChatMessage } from "../types";

export interface ChatStorageAdapter {
  clearRuntimeState(): Promise<void>;
  getNextIndex(channel: string): Promise<number>;
  getMessagesForChannel(channel: string): Promise<ChatMessage[]>;
  appendMessage(channel: string, message: ChatMessage): Promise<void>;
}
