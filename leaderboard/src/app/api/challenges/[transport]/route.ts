import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { sendMessage, getMessagesForChannel, type ChatMessage, getMessagesForChallengeChannel } from "@/app/api/chat/storage";
import { getChallengeFromInvite } from "@/app/api/challenges/storage";
import { generateRandomSetFromSeed } from "@/app/_shared/utils";
import { PsiChallenge } from "@/app/_challenges/psi";

const handler = createMcpHandler(
  (server) => {
    server.tool(
      "join_challenge",
      "Join a challenge by providing an invite code.",
      {
        invite: z.string().describe("The invite code to join the challenge"),
      },
      async ({ invite }) => {
        const challenge = getChallengeFromInvite(invite);
        const index = challenge.instance.join(invite);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ index: index, challenge: challenge.id, from: "operator"}),
            },
          ],
        };
      }
    );

    server.tool(
      "sync",
      "Get all information from the challenge operator",
      {
        channel: z.string().describe("The challenge UUID channel identifier"),
        index: z.number().int().min(0).describe("The starting index to fetch messages from"),
      },
      async ({ channel, index }) => {
        const messages = getMessagesForChallengeChannel(channel);
        const filteredMessages = messages.filter((msg: ChatMessage) => msg.index >= index);

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

