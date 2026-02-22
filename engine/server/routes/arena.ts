import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../../engine";
import { verifyJoinRequest, createSessionKey } from "../../auth";
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

    // If auth params provided, verify signature
    if (publicKey && signature && timestamp) {
      // Lookup challenge from invite to get challengeId
      const lookupResult = await engine.getChallengeFromInvite(invite);
      if (!lookupResult.success) {
        return c.json({ error: lookupResult.message }, 400);
      }
      const challengeId = lookupResult.data.id;

      const verification = verifyJoinRequest(publicKey, signature, challengeId, invite, timestamp);
      if (!verification.valid) {
        return c.json({ error: verification.reason }, 401);
      }

      const result = await engine.challengeJoin(invite, publicKey);
      if ("error" in result) {
        return c.json(result, 400);
      }

      // Compute userIndex and generate session key
      const challenge = await engine.getChallenge(result.ChallengeID!);
      const userIndex = challenge!.instance.state.players.indexOf(invite);
      const sessionKey = createSessionKey(engine.secret, challengeId, userIndex);

      return c.json({ ...result, sessionKey });
    }

    // Legacy: join without auth (no session key returned)
    const result = await engine.challengeJoin(invite);
    if ("error" in result) {
      return c.json(result, 400);
    }
    return c.json(result);
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

  // GET /api/arena/sync - Get messages from the challenge operator
  app.get("/api/arena/sync", sessionAuth, async (c) => {
    const channel = c.req.query("channel");
    const index = parseInt(c.req.query("index") || "0", 10);
    if (!channel) {
      return c.json({ error: "channel is required" }, 400);
    }

    const sessionUser = c.get("sessionUser") as SessionUser | undefined;
    const from = sessionUser?.invite ?? c.req.query("from");

    if (!from) {
      return c.json({ error: "channel and from are required" }, 400);
    }
    return c.json(await engine.challengeSync(channel, from, index));
  });

  return app;
}

export default createArenaRoutes();
