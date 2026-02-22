import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../../engine";

export function createArenaRoutes(engine: ArenaEngine = defaultEngine) {
  const app = new Hono();

  // POST /api/arena/join - Join a challenge with an invite code
  app.post("/api/arena/join", async (c) => {
    const { invite, publicKey, signature } = await c.req.json();
    if (!invite || !publicKey || !signature) {
      return c.json({ error: "invite, publicKey, and signature are required" }, 400);
    }
    const result = await engine.challengeJoin(invite, publicKey, signature);
    if ("error" in result) {
      return c.json(result, 400);
    }
    return c.json(result);
  });

  // POST /api/arena/message - Send a message to the challenge operator
  app.post("/api/arena/message", async (c) => {
    const { challengeId, messageType, content } = await c.req.json();
    const from = c.get("authInvite") as string;
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
  app.get("/api/arena/sync", async (c) => {
    const channel = c.req.query("channel");
    const from = c.get("authInvite") as string | undefined;
    const index = parseInt(c.req.query("index") || "0", 10);
    if (!channel) {
      return c.json({ error: "channel is required" }, 400);
    }
    return c.json(await engine.challengeSync(channel, from, index));
  });

  return app;
}

export default createArenaRoutes();
