import { ChatMessage } from '../types';

// Re-export ChatMessage for convenience
export type { ChatMessage } from '../types';

// Map: channel -> messages array
export const messagesByChannel = new Map<string, ChatMessage[]>();

// Map: channel -> current index counter
export const indexCounters = new Map<string, number>();

// Map: channel -> Set of Response objects for SSE connections
export const channelSubscribers = new Map<string, Set<ReadableStreamDefaultController>>();

export function getNextIndex(channel: string): number {
  const current = indexCounters.get(channel) || 0;
  const next = current + 1;
  indexCounters.set(channel, next);
  return next;
}

export function getMessagesForChallengeChannel(challengeId: string): ChatMessage[] {
  return messagesByChannel.get("challenge_" + challengeId) || [];
}

export function getMessagesForChannel(channel: string): ChatMessage[] {
  return messagesByChannel.get(channel) || [];
}

export function subscribeToChannel(channel: string, controller: ReadableStreamDefaultController): () => void {
  if (!channelSubscribers.has(channel)) {
    channelSubscribers.set(channel, new Set());
  }
  channelSubscribers.get(channel)!.add(controller);

  // Return unsubscribe function
  return () => {
    const subscribers = channelSubscribers.get(channel);
    if (subscribers) {
      subscribers.delete(controller);
      if (subscribers.size === 0) {
        channelSubscribers.delete(channel);
      }
    }
  };
}

export function notifyChannelSubscribers(channel: string, message: ChatMessage): void {
  const subscribers = channelSubscribers.get(channel);
  if (subscribers) {
    const data = JSON.stringify({ type: 'new_message', message });
    const messageToSend = `data: ${data}\n\n`;

    // Send to all subscribers, removing dead connections
    const deadConnections: ReadableStreamDefaultController[] = [];
    subscribers.forEach((controller) => {
      try {
        controller.enqueue(new TextEncoder().encode(messageToSend));
      } catch {
        // Connection is dead, mark for removal
        deadConnections.push(controller);
      }
    });

    // Remove dead connections
    deadConnections.forEach((controller) => {
      subscribers.delete(controller);
    });

    if (subscribers.size === 0) {
      channelSubscribers.delete(channel);
    }
  }
}

export function sendChallengeMessage(
  challengeId: string,
  from: string,
  content: string,
  to?: string | null
): ChatMessage {
  const channel = "challenge_" + challengeId;
  return sendMessage(channel, from, content, to);
}

export function sendMessage(
  channel: string,
  from: string,
  content: string,
  to?: string | null
): ChatMessage {
  const index = getNextIndex(channel);
  const message: ChatMessage = {
    channel,
    from,
    to,
    content: content || "",
    index,
    timestamp: Date.now(),
  };

  // Get or create messages array for this channel
  if (!messagesByChannel.has(channel)) {
    messagesByChannel.set(channel, []);
  }
  messagesByChannel.get(channel)!.push(message);

  // Notify WebSocket/SSE subscribers about the new message
  notifyChannelSubscribers(channel, message);

  return message;
}
