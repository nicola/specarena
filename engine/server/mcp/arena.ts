import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { ArenaEngine, defaultEngine } from "../../engine";
import { verifyJoinRequest, createSessionKey, validateSessionKey, parseSessionKey } from "../../auth";

export function createArenaHandler(options: { redisUrl?: string; basePath?: string; engine?: ArenaEngine } = {}) {
  const engine = options.engine ?? defaultEngine;

  return createMcpHandler(
    (server) => {
      server.tool(
        "challenge_join",
        "Join a challenge by providing an invite code with Ed25519 signature authentication.",
        {
          invite: z.string().describe("The invite code to join the challenge"),
          publicKey: z.string().optional().describe("Hex-encoded Ed25519 public key (DER/SPKI format)"),
          signature: z.string().optional().describe("Hex-encoded Ed25519 signature of 'challengeId:invite:timestamp'"),
          timestamp: z.number().optional().describe("Unix timestamp in milliseconds used in the signature"),
        },
        async ({ invite, publicKey, signature, timestamp }) => {
          if (publicKey && signature && timestamp) {
            // Lookup challenge from invite
            const lookupResult = await engine.getChallengeFromInvite(invite);
            if (!lookupResult.success) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ error: lookupResult.message }) }] };
            }
            const challengeId = lookupResult.data.id;

            const verification = verifyJoinRequest(publicKey, signature, challengeId, invite, timestamp);
            if (!verification.valid) {
              return { content: [{ type: "text" as const, text: JSON.stringify({ error: verification.reason }) }] };
            }

            const result = await engine.challengeJoin(invite, publicKey);
            if ("error" in result) {
              return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
            }

            const challenge = await engine.getChallenge(result.ChallengeID!);
            const userIndex = challenge!.instance.state.players.indexOf(invite);
            const sessionKey = createSessionKey(engine.secret, challengeId, userIndex);

            return { content: [{ type: "text" as const, text: JSON.stringify({ ...result, sessionKey }) }] };
          }

          // Legacy: no auth
          return {
            content: [{ type: "text" as const, text: JSON.stringify(await engine.challengeJoin(invite)) }],
          };
        }
      );

      server.tool(
        "challenge_message",
        "Send a message to the challenge operator (generally a function call)",
        {
          challengeId: z.string().describe("The id of the current challenge"),
          key: z.string().describe("Session key returned from challenge_join"),
          messageType: z.string().describe("The type of message to send"),
          content: z.string().describe("The content of the message, send it as a string"),
        },
        async ({ challengeId, key, messageType, content }) => {
          const validation = validateSessionKey(engine.secret, key, challengeId);
          if (!validation.valid) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Invalid session key" }) }] };
          }

          const challenge = await engine.getChallenge(challengeId);
          if (!challenge) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Challenge not found" }) }] };
          }

          if (challenge.instance.state.gameEnded) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Game has ended, key is no longer valid for writes" }) }] };
          }

          const from = challenge.instance.state.players[validation.userIndex];
          if (!from) {
            return { content: [{ type: "text" as const, text: JSON.stringify({ error: "Invalid session key" }) }] };
          }

          return {
            content: [{ type: "text" as const, text: JSON.stringify(await engine.challengeMessage(challengeId, from, messageType, content)) }],
          };
        }
      );

      server.tool(
        "challenge_sync",
        "Get all information from the challenge operator",
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

          return {
            content: [{ type: "text" as const, text: JSON.stringify(await engine.challengeSync(channel, from, index)) }],
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
