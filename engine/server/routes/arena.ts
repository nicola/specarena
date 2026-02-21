import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../../engine";
import { authErrorResponse, validateSessionForChallenge } from "../auth-utils";

export function createArenaRoutes(engine: ArenaEngine = defaultEngine) {
  const app = new Hono();

  // POST /api/arena/join - Join a challenge with an invite code
  app.post("/api/arena/join", async (c) => {
    const { invite, did, nonceId, signature, timestamp } = await c.req.json();
    if (!invite) {
      return c.json({ error: "invite is required" }, 400);
    }

    const proofResult = await engine.auth.verifyJoinProof({
      invite,
      did,
      nonceId,
      signature,
      timestamp,
    });
    if (!proofResult.success) {
      return c.json({ error: proofResult.message, code: proofResult.code }, 401);
    }

    const result = await engine.challengeJoin(invite);
    if ("error" in result) {
      return c.json(result, 400);
    }

    const auth = await engine.auth.issueSession({
      did: proofResult.data.did,
      invite,
      challengeId: result.ChallengeID,
      scope: ["arena:message", "arena:sync", "chat:send", "chat:sync"],
    });

    return c.json({
      ...result,
      auth,
    });
  });

  // POST /api/arena/message - Send a message to the challenge operator
  app.post("/api/arena/message", async (c) => {
    const { challengeId, messageType, content } = await c.req.json();
    if (!challengeId || !content) {
      return c.json({ error: "challengeId and content are required" }, 400);
    }

    const token = engine.auth.extractBearerToken(c.req.header("authorization"));
    const authResult = await validateSessionForChallenge({
      engine,
      token,
      expectedChallengeId: challengeId,
      requiredScope: "arena:message",
    });
    if (!authResult.success) {
      return c.json(authErrorResponse(authResult), authResult.status);
    }

    const from = authResult.claims.invite;
    const result = await engine.challengeMessage(challengeId, from, messageType || "", content);
    if ("error" in result) {
      return c.json(result, 400);
    }

    return c.json(result);
  });

  // GET /api/arena/sync - Get messages from the challenge operator
  app.get("/api/arena/sync", async (c) => {
    const channel = c.req.query("channel");
    const index = parseInt(c.req.query("index") || "0", 10);
    if (!channel) {
      return c.json({ error: "channel is required" }, 400);
    }

    const token = engine.auth.extractBearerToken(c.req.header("authorization"));
    const authResult = await validateSessionForChallenge({
      engine,
      token,
      expectedChallengeId: channel,
      requiredScope: "arena:sync",
    });
    if (!authResult.success) {
      return c.json(authErrorResponse(authResult), authResult.status);
    }

    return c.json(await engine.challengeSync(channel, authResult.claims.invite, index));
  });

  return app;
}

export default createArenaRoutes();
