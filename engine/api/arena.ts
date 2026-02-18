import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { type ChatMessage, getMessagesForChallengeChannel, sendChallengeMessage } from "../storage/chat";
import { getChallengeFromInvite, getChallenge, getChallengeMetadata } from "../storage/challenges";

export function createArenaHandler(options: { redisUrl?: string; basePath?: string } = {}) {
  return createMcpHandler(
    (server) => {
      server.tool(
        "challenge_join",
        "Join a challenge by providing an invite code.",
        {
          invite: z.string().describe("The invite code to join the challenge"),
        },
        async ({ invite }) => {
          const result = getChallengeFromInvite(invite);

          if (!result.success) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ error: result.message }),
                },
              ],
            };
          }
          const challenge = result.data;
          challenge.instance.join(invite);

          const metadata = getChallengeMetadata(challenge.challengeType);

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  ChallengeID: challenge.id,
                  ChallengeInfo: metadata,
                }),
              },
            ],
          };
        }
      );

      server.tool(
        "challenge_message",
        "Send a message to the challenge operator (generally a function call)",
        {
          challengeId: z.string().describe("The id of the current challenge"),
          from: z.string().describe("The user ID of the sender (the invite code)"),
          messageType: z.string().describe("The type of message to send"),
          content: z.string().describe("The content of the message, send it as a string"),
        },
        async ({ challengeId, from, messageType, content }) => {
          const challenge = getChallenge(challengeId);

          let response;

          sendChallengeMessage(challengeId, from, (messageType ? `(${messageType}) ` : '') + content, "operator");

          if (challenge && challenge.instance) {
            try {
              challenge.instance.message({
                channel: challengeId,
                from: from,
                type: messageType,
                content: content,
                timestamp: Date.now(),
              });

              response = {
                type: "text",
                text: "OK: Message sent",
              };
            } catch (error) {
              console.error("Error sending message:", error);
              response = {
                type: "status",
                error: error instanceof Error ? error.message : String(error),
              };
            }
          } else {
            response = {
              type: "status",
              error: "Challenge not found",
            };
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(response),
              },
            ],
          };
        }
      );

      server.tool(
        "challenge_sync",
        "Get all information from the challenge operator",
        {
          channel: z.string().describe("The challenge UUID channel identifier"),
          from: z.string().describe("The user ID of the sender"),
          index: z.number().int().min(0).describe("The starting index to fetch messages from"),
        },
        async ({ channel, from, index }) => {
          const messages = getMessagesForChallengeChannel(channel);
          const filteredMessages = messages.filter((msg: ChatMessage) =>
            msg.index !== undefined && msg.index >= index && (!msg.to || msg.to === from || msg.from === from));

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  messages: filteredMessages,
                  count: filteredMessages.length,
                }),
              },
            ],
          };
        }
      );
    },
    {
      // Optional server options
    },
    {
      redisUrl: options.redisUrl || process.env.REDIS_URL,
      basePath: options.basePath || "/api/arena",
      maxDuration: 60,
      verboseLogs: false,
    }
  );
}
