import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "@arena/engine/engine";
import { ChallengeError } from "@arena/engine/types";
import { JoinSchema, MessageSchema, SyncSchema } from "../schemas";
import { getIdentity, IdentityEnv } from "./identity";

function errorCodeToStatus(code?: string): 400 | 404 | 409 | 500 {
  switch (code) {
    case ChallengeError.NOT_FOUND:
      return 404;
    case ChallengeError.INVITE_ALREADY_USED:
      return 409;
    default:
      return 400;
  }
}

export function createArenaRoutes(engine: ArenaEngine = defaultEngine) {
  const app = new Hono<IdentityEnv>();

  // POST /api/arena/join - Join a challenge with an invite code
  app.post("/api/arena/join", async (c) => {
    const body = await c.req.json();
    const parsed = JoinSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0].message }, 400);
    }

    const { invite, userId } = parsed.data;
    const result = await engine.challengeJoin(invite, userId);
    if ("error" in result) {
      return c.json(result, errorCodeToStatus(result.code));
    }
    return c.json(result);
  });

  // POST /api/arena/message - Send a message to the challenge operator
  app.post("/api/arena/message", async (c) => {
    const body = await c.req.json();
    const parsed = MessageSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0].message }, 400);
    }

    const { challengeId, content, messageType } = parsed.data;

    const from = getIdentity(c);
    if (!from) {
      return c.json({ error: "from is required" }, 400);
    }

    const result = await engine.challengeMessage(challengeId, from, messageType || "", content);
    if ("error" in result) {
      return c.json(result, errorCodeToStatus(result.code));
    }
    return c.json(result);
  });

  // GET /api/arena/sync - Get messages from the challenge operator
  app.get("/api/arena/sync", async (c) => {
    const parsed = SyncSchema.safeParse({
      channel: c.req.query("channel"),
      index: c.req.query("index") ?? 0,
    });
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0].message }, 400);
    }

    const { channel, index } = parsed.data;
    const viewer = getIdentity(c);
    try {
      return c.json(await engine.challengeSync(channel, viewer, index));
    } catch (error) {
      console.error("Error syncing challenge:", error);
      return c.json({ error: "Failed to sync messages" }, 500);
    }
  });

  return app;
}

export default createArenaRoutes();
