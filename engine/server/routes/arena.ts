import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../../engine";
import { createSessionAuth, getIdentity, AuthEnv } from "../../auth/middleware";

export function createArenaRoutes(engine: ArenaEngine = defaultEngine) {
  const app = new Hono<AuthEnv>();
  const sessionAuth = createSessionAuth(engine);

  // POST /api/arena/join - Join a challenge with an invite code
  app.post("/api/arena/join", async (c) => {
    const body = await c.req.json();
    const { invite } = body;
    if (!invite) {
      return c.json({ error: "invite is required" }, 400);
    }

    if (engine.auth) {
      // Auth ON: require Ed25519 signature
      const { publicKey, signature, timestamp } = body;
      if (!publicKey || !signature || !timestamp) {
        return c.json({ error: "publicKey, signature, and timestamp are required" }, 400);
      }

      const authResult = engine.auth.authenticateJoin(publicKey, signature, invite, timestamp);
      if (!authResult.valid) {
        return c.json({ error: authResult.reason }, 401);
      }

      const result = await engine.challengeJoin(invite);
      if ("error" in result) {
        return c.json(result, 400);
      }

      // Find userIndex for this invite to create session key
      const challenge = await engine.getChallengeFromInvite(invite);
      if (!challenge.success) {
        return c.json(result);
      }
      const userIndex = challenge.data.instance.state.players.indexOf(invite);
      const sessionKey = engine.auth.createSessionKey(challenge.data.id, userIndex);

      return c.json({ ...result, sessionKey });
    }

    // Auth OFF: just join with invite
    const result = await engine.challengeJoin(invite);
    if ("error" in result) {
      return c.json(result, 400);
    }
    return c.json(result);
  });

  // POST /api/arena/message - Send a message to the challenge operator
  app.post("/api/arena/message", sessionAuth, async (c) => {
    const { challengeId, messageType, content, from: bodyFrom } = await c.req.json();
    if (!challengeId || !content) {
      return c.json({ error: "challengeId and content are required" }, 400);
    }

    const from = getIdentity(c, bodyFrom);
    if (!from) {
      return c.json({ error: engine.auth ? "Authentication required" : "from is required" }, engine.auth ? 401 : 400);
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

    const viewer = getIdentity(c, c.req.query("from"));
    return c.json(await engine.challengeSync(channel, viewer, index));
  });

  return app;
}

export default createArenaRoutes();
