import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { sendMessage, getMessagesForChannel, type ChatMessage, getMessagesForChallengeChannel, sendChallengeMessage } from "@/app/api/chat/storage";
import { getChallengeFromInvite, getChallenge } from "@/app/api/challenges/storage";
import { generateRandomSetFromSeed } from "@/app/_shared/utils";
import { PsiChallenge } from "@/app/_challenges/psi";
import challenges from "@/app/challenges/challenges.json";

// Force dynamic rendering and Node.js runtime for MCP
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "challenge_join",
      "Join a challenge by providing an invite code.",
      {
        invite: z.string().describe("The invite code to join the challenge"),
      },
      async ({ invite }) => {
        const challenge = getChallengeFromInvite(invite);
        challenge.instance.join(invite);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                ChallengeID: challenge.id,
                ChallengeInfo: challenges[challenge.challengeType as keyof typeof challenges],
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

        let response

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
    // Optional redis config
    redisUrl: process.env.REDIS_URL,
    basePath: "/api/challenges", // this needs to match where the [transport] is located.
    maxDuration: 60,
    verboseLogs: true,
  }
);
export { handler as GET, handler as POST, handler as DELETE };

