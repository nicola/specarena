import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { ArenaEngine, defaultEngine } from "../../engine";
import { validateSessionForChallenge } from "../auth-utils";

export function createArenaHandler(options: { redisUrl?: string; basePath?: string; engine?: ArenaEngine } = {}) {
  const engine = options.engine ?? defaultEngine;

  return createMcpHandler(
    (server) => {
      server.tool(
        "auth_nonce",
        "Issue a short-lived nonce used to prove did:key ownership during challenge_join.",
        {
          purpose: z.literal("join").describe("Nonce purpose, currently only 'join'"),
          invite: z.string().describe("The invite code that will be used to join"),
        },
        async ({ invite }) => ({
          content: [{
            type: "text",
            text: JSON.stringify({
              ...engine.auth.issueJoinNonce(invite),
              proofRequired: engine.auth.isJoinProofRequired(),
            }),
          }],
        })
      );

      server.tool(
        "challenge_join",
        "Join a challenge by providing an invite code.",
        {
          invite: z.string().describe("The invite code to join the challenge"),
          did: z.string().optional().describe("Agent identity as did:key"),
          nonceId: z.string().optional().describe("Nonce id returned by auth_nonce"),
          signature: z.string().optional().describe("Base64/base64url Ed25519 signature over join proof payload"),
          timestamp: z.number().int().optional().describe("Unix timestamp in milliseconds used in join proof payload"),
        },
        async ({ invite, did, nonceId, signature, timestamp }) => {
          const proofResult = await engine.auth.verifyJoinProof({
            invite,
            did,
            nonceId,
            signature,
            timestamp,
          });
          if (!proofResult.success) {
            return { content: [{ type: "text", text: JSON.stringify({ error: proofResult.message, code: proofResult.code }) }] };
          }

          const joinResult = await engine.challengeJoin(invite);
          if ("error" in joinResult) {
            return { content: [{ type: "text", text: JSON.stringify(joinResult) }] };
          }

          const auth = await engine.auth.issueSession({
            did: proofResult.data.did,
            invite,
            challengeId: joinResult.ChallengeID,
            scope: ["arena:message", "arena:sync", "chat:send", "chat:sync"],
          });

          return {
            content: [{ type: "text", text: JSON.stringify({ ...joinResult, auth }) }],
          };
        }
      );

      server.tool(
        "challenge_message",
        "Send a message to the challenge operator (generally a function call)",
        {
          authToken: z.string().optional().describe("Session bearer token returned by challenge_join"),
          challengeId: z.string().describe("The id of the current challenge"),
          messageType: z.string().describe("The type of message to send"),
          content: z.string().describe("The content of the message, send it as a string"),
        },
        async ({ authToken, challengeId, messageType, content }) => {
          const authResult = await validateSessionForChallenge({
            engine,
            token: authToken ?? null,
            expectedChallengeId: challengeId,
            requiredScope: "arena:message",
          });
          if (!authResult.success) {
            return { content: [{ type: "text", text: JSON.stringify({ error: authResult.message, code: authResult.code }) }] };
          }

          const result = await engine.challengeMessage(
            challengeId,
            authResult.claims.invite,
            messageType,
            content
          );

          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        }
      );

      server.tool(
        "challenge_sync",
        "Get all information from the challenge operator",
        {
          authToken: z.string().optional().describe("Session bearer token returned by challenge_join"),
          channel: z.string().describe("The challenge UUID channel identifier"),
          index: z.number().int().min(0).describe("The starting index to fetch messages from"),
        },
        async ({ authToken, channel, index }) => {
          const authResult = await validateSessionForChallenge({
            engine,
            token: authToken ?? null,
            expectedChallengeId: channel,
            requiredScope: "arena:sync",
          });
          if (!authResult.success) {
            return { content: [{ type: "text", text: JSON.stringify({ error: authResult.message, code: authResult.code }) }] };
          }

          return {
            content: [{ type: "text", text: JSON.stringify(await engine.challengeSync(channel, authResult.claims.invite, index)) }],
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
