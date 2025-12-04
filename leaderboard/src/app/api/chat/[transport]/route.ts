import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { sendMessage, getMessagesForChannel, type ChatMessage } from "../storage";

// Force dynamic rendering and Node.js runtime for MCP
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const handler = createMcpHandler(
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
      async ({ channel, from, to, content }) => {

        console.log("send_chat", channel, from, to, content);
        const message = sendMessage(channel, from, content, to);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ index: message.index, channel, from, to: to ?? null }),
            },
          ],
        };
      }
    );

    server.tool(
      "sync",
      "Get all messages from a channel starting from a specific index",
      {
        channel: z.string().describe("The challenge UUID channel identifier"),
        index: z.number().int().min(0).describe("The starting index to fetch messages from"),
      },
      async ({ channel, index }) => {
        const messages = getMessagesForChannel(channel);
        const filteredMessages = messages.filter((msg: ChatMessage) => msg.index !== undefined && msg.index >= index);

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
    basePath: "/api/chat", // this needs to match where the [transport] is located.
    maxDuration: 60,
    verboseLogs: true,
  }
);
export { handler as GET, handler as POST, handler as DELETE };