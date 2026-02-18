import { Hono } from "hono";
import { challengeJoin, challengeMessage, challengeSync } from "../actions/arena";

const app = new Hono();

// POST /api/arena/join - Join a challenge with an invite code
app.post("/api/arena/join", async (c) => {
  const { invite } = await c.req.json();
  if (!invite) {
    return c.json({ error: "invite is required" }, 400);
  }
  const result = challengeJoin(invite);
  if ("error" in result) {
    return c.json(result, 400);
  }
  return c.json(result);
});

// POST /api/arena/message - Send a message to the challenge operator
app.post("/api/arena/message", async (c) => {
  const { challengeId, from, messageType, content } = await c.req.json();
  if (!challengeId || !from || !content) {
    return c.json({ error: "challengeId, from, and content are required" }, 400);
  }
  const result = challengeMessage(challengeId, from, messageType || "", content);
  if ("error" in result) {
    return c.json(result, 400);
  }
  return c.json(result);
});

// GET /api/arena/sync - Get messages from the challenge operator
app.get("/api/arena/sync", (c) => {
  const channel = c.req.query("channel");
  const from = c.req.query("from");
  const index = parseInt(c.req.query("index") || "0", 10);
  if (!channel || !from) {
    return c.json({ error: "channel and from are required" }, 400);
  }
  return c.json(challengeSync(channel, from, index));
});

export default app;
