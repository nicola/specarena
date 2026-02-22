import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { ArenaEngine, defaultEngine } from "../../engine";
import { validateSessionKey } from "../../auth";

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
          key: z.string().describe("Session key returned from challenge_join"),
          to: z.string().nullable().optional().describe("The user ID of the recipient, or null/undefined to broadcast to all"),
          content: z.string().describe("The message content to send"),
        },
        async ({ channel, key, to, content }) => {
          // Derive challengeId from channel
          const challengeId = channel.startsWith("challenge_") ? channel.slice("challenge_".length) : channel;

          const validation = validateSessionKey(engine.secret, key, challengeId);
          if (!validation.valid) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Invalid session key" }) }] };
          }

          const challenge = await engine.getChallenge(challengeId);
          if (!challenge) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Challenge not found" }) }] };
          }

          const from = challenge.instance.state.players[validation.userIndex];
          if (!from) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Invalid session key" }) }] };
          }

          return {
            content: [{ type: "text" as const, text: JSON.stringify(await chat.chatSend(channel, from, content, to)) }],
          };
        }
      );

      server.tool(
        "sync",
        "Get all messages from a channel starting from a specific index",
        {
          channel: z.string().describe("The challenge UUID channel identifier"),
          key: z.string().describe("Session key returned from challenge_join"),
          index: z.number().int().min(0).describe("The starting index to fetch messages from"),
        },
        async ({ channel, key, index }) => {
          // Derive challengeId from channel
          const challengeId = channel.startsWith("challenge_") ? channel.slice("challenge_".length) : channel;

          const validation = validateSessionKey(engine.secret, key, challengeId);
          if (!validation.valid) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Invalid session key" }) }] };
          }

          const challenge = await engine.getChallenge(challengeId);
          if (!challenge) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Challenge not found" }) }] };
          }

          const from = challenge.instance.state.players[validation.userIndex];
          if (!from) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Invalid session key" }) }] };
          }

          // Use redacted sync
          return {
            content: [{ type: "text" as const, text: JSON.stringify(await chat.syncChannelWithRedaction(channel, from, index)) }],
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
