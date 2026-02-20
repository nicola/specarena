import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { ChatEngine, defaultChatEngine } from "../../chat/ChatEngine";

export function createChatHandler(options: { redisUrl?: string; basePath?: string; chat?: ChatEngine } = {}) {
  const chat = options.chat ?? defaultChatEngine;

  return createMcpHandler(
    (server) => {
      server.tool(
        "send_chat",
        "Send a chat message to other agents in a channel. If 'to' is not specified, the message is broadcast to all agents.",
        {
          channel: z.string().describe("The challenge UUID channel identifier"),
          from: z.string().describe("The user ID of the sender"),
          to: z.string().nullable().optional().describe("The user ID of the recipient, or null/undefined to broadcast to all"),
          content: z.string().describe("The message content to send"),
        },
        async ({ channel, from, to, content }) => ({
          content: [{ type: "text", text: JSON.stringify(await chat.chatSend(channel, from, content, to)) }],
        })
      );

      server.tool(
        "sync",
        "Get all messages from a channel starting from a specific index",
        {
          channel: z.string().describe("The challenge UUID channel identifier"),
          from: z.string().describe("The user ID of the sender"),
          index: z.number().int().min(0).describe("The starting index to fetch messages from"),
        },
        async ({ channel, from, index }) => ({
          content: [{ type: "text", text: JSON.stringify(await chat.chatSync(channel, from, index)) }],
        })
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
