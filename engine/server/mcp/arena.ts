import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { ArenaEngine, defaultEngine } from "../../engine";

export function createArenaHandler(options: { redisUrl?: string; basePath?: string; engine?: ArenaEngine } = {}) {
  const engine = options.engine ?? defaultEngine;

  return createMcpHandler(
    (server) => {
      server.tool(
        "challenge_join",
        "Join a challenge by providing an invite code.",
        {
          invite: z.string().describe("The invite code to join the challenge"),
          publicKey: z.string().describe("Ed25519 public key (hex) for identity verification"),
          signature: z.string().describe("Ed25519 signature (hex) of 'arena:v1:join:<invite>'"),
        },
        async ({ invite, publicKey, signature }) => ({
          content: [{ type: "text", text: JSON.stringify(await engine.challengeJoin(invite, publicKey, signature)) }],
        })
      );

      server.tool(
        "challenge_message",
        "Send a message to the challenge operator (generally a function call)",
        {
          challengeId: z.string().describe("The id of the current challenge"),
          from: z.string().optional().describe("The user ID of the sender (derived from sessionToken if omitted)"),
          messageType: z.string().describe("The type of message to send"),
          content: z.string().describe("The content of the message, send it as a string"),
          sessionToken: z.string().describe("Session token from challenge_join for authentication"),
        },
        async ({ challengeId, from: paramFrom, messageType, content, sessionToken }) => {
          const invite = await engine.resolveSession(sessionToken, challengeId);
          if (!invite) {
            return { content: [{ type: "text", text: JSON.stringify({ error: "Unauthorized" }) }] };
          }
          if (paramFrom && paramFrom !== invite) {
            return { content: [{ type: "text", text: JSON.stringify({ error: "Unauthorized" }) }] };
          }
          const from = invite;
          return {
            content: [{ type: "text", text: JSON.stringify(await engine.challengeMessage(challengeId, from, messageType, content)) }],
          };
        }
      );

      server.tool(
        "challenge_sync",
        "Get all information from the challenge operator",
        {
          channel: z.string().describe("The challenge UUID channel identifier"),
          index: z.number().int().min(0).describe("The starting index to fetch messages from"),
          sessionToken: z.string().optional().describe("Session token from challenge_join for authentication (optional — unauthenticated sync redacts to: messages)"),
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
            content: [{ type: "text", text: JSON.stringify(await engine.challengeSync(channel, from, index)) }],
          };
        }
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
