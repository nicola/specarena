import { type ChatMessage, getMessagesForChallengeChannel, sendChallengeMessage, sendMessage } from "../storage/chat";
import { getChallengeFromInvite, getChallenge, getChallengeMetadata } from "../storage/challenges";

export function challengeJoin(invite: string) {
  const result = getChallengeFromInvite(invite);

  if (!result.success) {
    return { error: result.message };
  }

  const challenge = result.data;

  try {
    challenge.instance.join(invite);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }

  const metadata = getChallengeMetadata(challenge.challengeType);

  return {
    ChallengeID: challenge.id,
    ChallengeInfo: metadata,
  };
}

export function challengeMessage(challengeId: string, from: string, messageType: string, content: string) {
  const challenge = getChallenge(challengeId);

  sendChallengeMessage(challengeId, from, (messageType ? `(${messageType}) ` : '') + content, "operator");

  if (!challenge || !challenge.instance) {
    return { error: "Challenge not found" };
  }

  try {
    challenge.instance.message({
      channel: challengeId,
      from,
      type: messageType,
      content,
      timestamp: Date.now(),
    });
    return { ok: "Message sent" };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export function challengeSync(channel: string, from: string, index: number) {
  const messages = getMessagesForChallengeChannel(channel);
  const filteredMessages = messages.filter((msg: ChatMessage) =>
    msg.index !== undefined && msg.index >= index && (!msg.to || msg.to === from || msg.from === from));

  return {
    messages: filteredMessages,
    count: filteredMessages.length,
  };
}
