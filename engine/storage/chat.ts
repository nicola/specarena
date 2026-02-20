import { ChatMessage } from '../types';
import { defaultEngine } from '../engine';

// Re-export ChatMessage for convenience
export type { ChatMessage } from '../types';

// Map: channel -> messages array
export const messagesByChannel = defaultEngine.messagesByChannel;

// Map: channel -> current index counter
export const indexCounters = defaultEngine.indexCounters;

// Map: channel -> Set of Response objects for SSE connections
export const channelSubscribers = defaultEngine.channelSubscribers;

export function getNextIndex(channel: string): number {
  return defaultEngine.getNextIndex(channel);
}

export function getMessagesForChallengeChannel(challengeId: string): ChatMessage[] {
  return defaultEngine.getMessagesForChallengeChannel(challengeId);
}

export function getMessagesForChannel(channel: string): ChatMessage[] {
  return defaultEngine.getMessagesForChannel(channel);
}

export function subscribeToChannel(channel: string, controller: ReadableStreamDefaultController): () => void {
  return defaultEngine.subscribeToChannel(channel, controller);
}

export function notifyChannelSubscribers(channel: string, message: ChatMessage): void {
  defaultEngine.notifyChannelSubscribers(channel, message);
}

export function sendChallengeMessage(
  challengeId: string,
  from: string,
  content: string,
  to?: string | null
): ChatMessage {
  return defaultEngine.sendChallengeMessage(challengeId, from, content, to);
}

export function sendMessage(
  channel: string,
  from: string,
  content: string,
  to?: string | null
): ChatMessage {
  return defaultEngine.sendMessage(channel, from, content, to);
}
