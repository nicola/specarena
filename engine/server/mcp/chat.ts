import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { ArenaEngine, defaultEngine } from "../../engine";

export function createChatHandler(options: { redisUrl?: string; basePath?: string; engine?: ArenaEngine } = {}) {
  const engine = options.engine ?? defaultEngine;
  const chat = engine.chat;
  const auth = engine.auth;

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
          sessionToken: z.string().optional().describe("Session token for authentication (not needed for invites channel)"),
          publicKey: z.string().optional().describe("Ed25519 public key (hex) for self-certification on invites channel"),
          signature: z.string().optional().describe("Ed25519 signature (hex) of 'arena:v1:chat:<channel>:<content>' for self-certification"),
        },
        async ({ channel, from: paramFrom, to, content, sessionToken, publicKey, signature }) => {
          let from = paramFrom;

          // Resolve identity from session token for non-invites channels
          if (channel !== "invites" && sessionToken) {
            const invite = await engine.resolveSession(sessionToken, channel);
            if (!invite) {
              return { content: [{ type: "text", text: JSON.stringify({ error: "Unauthorized" }) }] };
            }
            if (from && from !== invite) {
              return { content: [{ type: "text", text: JSON.stringify({ error: "Unauthorized" }) }] };
            }
            from = invite;
          }

          if (!from) {
            return { content: [{ type: "text", text: JSON.stringify({ error: "from or sessionToken is required" }) }] };
          }

          // Optional self-cert for invites channel
          let verifiedPublicKey: string | undefined;
          if (channel === "invites" && publicKey && signature && auth) {
            if (auth.verifyChatSignature(publicKey, channel, content, signature)) {
              verifiedPublicKey = publicKey;
            }
          }

          return {
            content: [{ type: "text", text: JSON.stringify(await chat.chatSend(channel, from, content, to, verifiedPublicKey)) }],
          };
        }
      );

      server.tool(
        "sync",
        "Get all messages from a channel starting from a specific index",
        {
          channel: z.string().describe("The challenge UUID channel identifier"),
          from: z.string().optional().describe("The user ID of the sender (derived from sessionToken if omitted)"),
          index: z.number().int().min(0).describe("The starting index to fetch messages from"),
          sessionToken: z.string().optional().describe("Session token for authentication (not needed for invites channel)"),
        },
        async ({ channel, from: paramFrom, index, sessionToken }) => {
          let from = paramFrom;

          // Resolve identity from session token for non-invites channels
          if (channel !== "invites" && sessionToken) {
            const invite = await engine.resolveSession(sessionToken, channel);
            if (!invite) {
              return { content: [{ type: "text", text: JSON.stringify({ error: "Unauthorized" }) }] };
            }
            if (from && from !== invite) {
              return { content: [{ type: "text", text: JSON.stringify({ error: "Unauthorized" }) }] };
            }
            from = invite;
          }

          if (!from) {
            return { content: [{ type: "text", text: JSON.stringify({ error: "from or sessionToken is required" }) }] };
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
