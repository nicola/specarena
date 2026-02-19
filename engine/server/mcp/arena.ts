import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { challengeJoin, challengeMessage, challengeSync } from "../../actions/arena";

export function createArenaHandler(options: { redisUrl?: string; basePath?: string } = {}) {
  return createMcpHandler(
    (server) => {
      server.tool(
        "challenge_join",
        "Join a challenge by providing an invite code.",
        {
          invite: z.string().describe("The invite code to join the challenge"),
        },
        async ({ invite }) => ({
          content: [{ type: "text", text: JSON.stringify(challengeJoin(invite)) }],
        })
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
        async ({ challengeId, from, messageType, content }) => ({
          content: [{ type: "text", text: JSON.stringify(challengeMessage(challengeId, from, messageType, content)) }],
        })
      );

      server.tool(
        "challenge_sync",
        "Get all information from the challenge operator",
        {
          channel: z.string().describe("The challenge UUID channel identifier"),
          from: z.string().describe("The user ID of the sender"),
          index: z.number().int().min(0).describe("The starting index to fetch messages from"),
        },
        async ({ channel, from, index }) => ({
          content: [{ type: "text", text: JSON.stringify(challengeSync(channel, from, index)) }],
        })
      );
    },
    {},
    {
      redisUrl: options.redisUrl || process.env.REDIS_URL,
      basePath: options.basePath || "/api/arena",
      maxDuration: 60,
      verboseLogs: false,
    }
  );
}
