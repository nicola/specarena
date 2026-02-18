import { sendMessage, getMessagesForChannel, type ChatMessage } from "../storage/chat";

export function chatSend(channel: string, from: string, content: string, to?: string | null) {
  const message = sendMessage(channel, from, content, to);
  return { index: message.index, channel, from, to: to ?? null };
}

export function chatSync(channel: string, from: string, index: number) {
  const messages = getMessagesForChannel(channel);
  const filteredMessages = messages.filter((msg: ChatMessage) =>
    msg.index !== undefined && msg.index >= index && (!msg.to || msg.to === from || msg.from === from));

  return {
    messages: filteredMessages,
    count: filteredMessages.length,
  };
}
