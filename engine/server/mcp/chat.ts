import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { ChatEngine, defaultChatEngine } from "../../chat/ChatEngine";
import { ArenaEngine, defaultEngine } from "../../engine";
import { validateSessionForChallenge } from "../auth-utils";

export function createChatHandler(
  options: { redisUrl?: string; basePath?: string; chat?: ChatEngine; engine?: ArenaEngine } = {}
) {
  const chat = options.chat ?? defaultChatEngine;
  const engine = options.engine ?? defaultEngine;

  return createMcpHandler(
    (server) => {
      server.tool(
        "send_chat",
        "Send a chat message to other agents in a channel. If 'to' is not specified, the message is broadcast to all agents.",
        {
          authToken: z.string().optional().describe("Session bearer token returned by challenge_join (required for non-invites channels)"),
          channel: z.string().describe("The challenge UUID channel identifier"),
          from: z.string().optional().describe("Sender identity for invites channel only"),
          to: z.string().nullable().optional().describe("The user ID of the recipient, or null/undefined to broadcast to all"),
          content: z.string().describe("The message content to send"),
        },
        async ({ authToken, channel, from, to, content }) => {
          if (channel === "invites") {
            if (!from) {
              return { content: [{ type: "text", text: JSON.stringify({ error: "from is required for invites channel", code: "AUTH_REQUIRED" }) }] };
            }
            return { content: [{ type: "text", text: JSON.stringify(await chat.chatSend(channel, from, content, to)) }] };
          }

          const authResult = await validateSessionForChallenge({
            engine,
            token: authToken ?? null,
            expectedChallengeId: channel,
            requiredScope: "chat:send",
          });
          if (!authResult.success) {
            return { content: [{ type: "text", text: JSON.stringify({ error: authResult.message, code: authResult.code }) }] };
          }

          return {
            content: [{ type: "text", text: JSON.stringify(await chat.chatSend(channel, authResult.claims.invite, content, to)) }],
          };
        }
      );

      server.tool(
        "sync",
        "Get all messages from a channel starting from a specific index",
        {
          authToken: z.string().optional().describe("Session bearer token returned by challenge_join (required for non-invites channels)"),
          channel: z.string().describe("The challenge UUID channel identifier"),
          from: z.string().optional().describe("Sender identity for invites channel only"),
          index: z.number().int().min(0).describe("The starting index to fetch messages from"),
        },
        async ({ authToken, channel, from, index }) => {
          if (channel === "invites") {
            if (!from) {
              return { content: [{ type: "text", text: JSON.stringify({ error: "from is required for invites channel", code: "AUTH_REQUIRED" }) }] };
            }
            return { content: [{ type: "text", text: JSON.stringify(await chat.chatSync(channel, from, index)) }] };
          }

          const authResult = await validateSessionForChallenge({
            engine,
            token: authToken ?? null,
            expectedChallengeId: channel,
            requiredScope: "chat:sync",
          });
          if (!authResult.success) {
            return { content: [{ type: "text", text: JSON.stringify({ error: authResult.message, code: authResult.code }) }] };
          }

          return {
            content: [{ type: "text", text: JSON.stringify(await chat.chatSync(channel, authResult.claims.invite, index)) }],
          };
        }
      );
    },
    {},
    {
      redisUrl: options.redisUrl || process.env.REDIS_URL,
      basePath: options.basePath || "/api/chat",
      maxDuration: 60,
      verboseLogs: false,
    }
  );
}
