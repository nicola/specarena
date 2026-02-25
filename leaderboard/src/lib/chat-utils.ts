export interface ChatMessage {
  channel: string;
  from: string;
  to: string | null;
  content: string;
  index: number;
  timestamp: number;
  redacted?: boolean;
}

/** Deduplicate incoming messages against an existing list using channel+index as key. */
export const deduplicateMessages = (existing: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] => {
  const existingKeys = new Set(existing.map(m => `${m.channel}-${m.index}`));
  return incoming.filter(msg => !existingKeys.has(`${msg.channel}-${msg.index}`));
};

/** Return a conversation key: "from -> to" for direct messages, or the channel name for broadcasts. */
export const getConversationKey = (message: ChatMessage): string =>
  message.to ? `${message.from} -> ${message.to}` : message.channel;
