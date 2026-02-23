import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../../engine";
import { getIdentity, IdentityEnv } from "./identity";

export function createArenaRoutes(engine: ArenaEngine = defaultEngine) {
  const app = new Hono<IdentityEnv>();

  // POST /api/arena/join - Join a challenge with an invite code
  app.post("/api/arena/join", async (c) => {
    const body = await c.req.json();
    const { invite, userId } = body;
    if (!invite) {
      return c.json({ error: "invite is required" }, 400);
    }

    const result = await engine.challengeJoin(invite, userId);
    if ("error" in result) {
      return c.json(result, 400);
    }
    return c.json(result);
  });

  // POST /api/arena/message - Send a message to the challenge operator
  app.post("/api/arena/message", async (c) => {
    const { challengeId, messageType, content, from: bodyFrom } = await c.req.json();
    if (!challengeId || !content) {
      return c.json({ error: "challengeId and content are required" }, 400);
    }

    const from = getIdentity(c);
    if (!from) {
      return c.json({ error: "from is required" }, 400);
    }

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

    const viewer = getIdentity(c);
    return c.json(await engine.challengeSync(channel, viewer, index));
  });

  return app;
}

export default createArenaRoutes();
