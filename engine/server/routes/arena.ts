import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../../engine";
import { verifyJoinRequest } from "../../auth";
import { createSessionAuthMiddleware, SessionUser } from "../../auth/middleware";

export function createArenaRoutes(engine: ArenaEngine = defaultEngine) {
  const app = new Hono();
  const sessionAuth = createSessionAuthMiddleware(engine);

  // POST /api/arena/join - Join a challenge with an invite code + Ed25519 signature
  app.post("/api/arena/join", async (c) => {
    const { invite, publicKey, signature, timestamp } = await c.req.json();
    if (!invite) {
      return c.json({ error: "invite is required" }, 400);
    }

    // All auth params must be provided together
    const hasAnyAuth = publicKey || signature || timestamp !== undefined;
    const hasAllAuth = publicKey && signature && timestamp !== undefined;
    if (hasAnyAuth && !hasAllAuth) {
      return c.json({ error: "publicKey, signature, and timestamp must all be provided together" }, 400);
    }

    if (!hasAllAuth) {
      return c.json({ error: "publicKey, signature, and timestamp are required" }, 400);
    }

    // Validate timestamp is a number
    if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) {
      return c.json({ error: "timestamp must be a finite number" }, 400);
    }

    // Lookup challenge from invite to get challengeId
    const lookupResult = await engine.getChallengeFromInvite(invite);
    if (!lookupResult.success) {
      return c.json({ error: lookupResult.message }, 400);
    }
    const challengeId = lookupResult.data.id;

    const verification = verifyJoinRequest(publicKey, signature, challengeId, invite, timestamp);
    if (!verification.valid) {
      return c.json({ error: "Authentication failed" }, 401);
    }

    const result = await engine.challengeJoin(invite, publicKey);
    if ("error" in result) {
      return c.json(result, 400);
    }

    // Compute userIndex and generate session key
    const challenge = await engine.getChallenge(result.ChallengeID!);
    if (!challenge) {
      return c.json({ error: "Challenge not found" }, 500);
    }
    const userIndex = challenge.instance.state.players.indexOf(invite);
    if (userIndex < 0) {
      return c.json({ error: "Failed to determine player index" }, 500);
    }
    const sessionKey = engine.createSessionKey(challengeId, userIndex);

    return c.json({ ...result, sessionKey });
  });

  // POST /api/arena/message - Send a message to the challenge operator
  app.post("/api/arena/message", sessionAuth, async (c) => {
    const sessionUser = c.get("sessionUser") as SessionUser;
    const { challengeId, messageType, content } = await c.req.json();
    const from = sessionUser.invite;

    if (!challengeId || !content) {
      return c.json({ error: "challengeId and content are required" }, 400);
    }
    const result = await engine.challengeMessage(challengeId, from, messageType || "", content);
    if ("error" in result) {
      return c.json(result, 400);
    }
    return c.json(result);
  });

  // GET /api/arena/sync - Get messages from the challenge operator (requires auth)
  app.get("/api/arena/sync", sessionAuth, async (c) => {
    const channel = c.req.query("channel");
    const index = Math.max(0, parseInt(c.req.query("index") || "0", 10) || 0);
    if (!channel) {
      return c.json({ error: "channel is required" }, 400);
    }

    const sessionUser = c.get("sessionUser") as SessionUser | undefined;
    if (!sessionUser) {
      return c.json({ error: "Authentication required" }, 401);
    }

    return c.json(await engine.challengeSync(channel, sessionUser.invite, index));
  });

  return app;
}

export default createArenaRoutes();
