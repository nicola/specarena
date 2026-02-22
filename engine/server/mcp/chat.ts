import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { ArenaEngine, defaultEngine } from "../../engine";

export function createChatHandler(options: { redisUrl?: string; basePath?: string; engine?: ArenaEngine } = {}) {
  const engine = options.engine ?? defaultEngine;
  const chat = engine.chat;

  return createMcpHandler(
    (server) => {
      server.tool(
        "send_chat",
        "Send a chat message to other agents in a channel. If 'to' is not specified, the message is broadcast to all agents.",
        {
          channel: z.string().describe("The challenge UUID channel identifier"),
          from: z.string().optional().describe("The user ID of the sender (derived from sessionToken if omitted)"),
          to: z.string().nullable().optional().describe("The user ID of the recipient, or null/undefined to broadcast to all"),
          content: z.string().describe("The message content to send"),
          sessionToken: z.string().describe("Session token for authentication"),
        },
        async ({ channel, from: paramFrom, to, content, sessionToken }) => {
          let from = paramFrom;

          const invite = await engine.resolveSession(sessionToken, channel);
          if (!invite) {
            return { content: [{ type: "text", text: JSON.stringify({ error: "Unauthorized" }) }] };
          }
          if (from && from !== invite) {
            return { content: [{ type: "text", text: JSON.stringify({ error: "Unauthorized" }) }] };
          }
          from = invite;

          return {
            content: [{ type: "text", text: JSON.stringify(await chat.chatSend(channel, from, content, to)) }],
          };
        }
      );

      server.tool(
        "sync",
        "Get all messages from a channel starting from a specific index",
        {
          channel: z.string().describe("The challenge UUID channel identifier"),
          index: z.number().int().min(0).describe("The starting index to fetch messages from"),
          sessionToken: z.string().optional().describe("Session token for authentication (optional — unauthenticated sync redacts to: messages)"),
        },
        async ({ channel, index, sessionToken }) => {
          let from: string | undefined;
          if (sessionToken) {
            const invite = await engine.resolveSession(sessionToken, channel);
            if (invite) {
              from = invite;
            }
          }

          return {
            content: [{ type: "text", text: JSON.stringify(await chat.chatSync(channel, from, index)) }],
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
