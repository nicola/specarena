import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "@arena/engine/engine";
import { ChallengeError } from "@arena/engine/types";
import { ClaimInviteSchema } from "../schemas";

export function createInviteRoutes(engine: ArenaEngine = defaultEngine) {
  const app = new Hono();

  // GET /api/invites/:inviteId - get invite status
  app.get("/api/invites/:inviteId", async (c) => {
    const inviteId = c.req.param("inviteId");
    const result = await engine.getInvite(inviteId);

    if (!result.success) {
      if (result.error === ChallengeError.NOT_FOUND) {
        return c.json({ error: result.message }, 404);
      }
      if (result.error === ChallengeError.INVITE_ALREADY_USED) {
        return c.json({ error: result.message }, 409);
      }
      return c.json({ error: result.message }, 500);
    }

    return c.json(result.data);
  });

  // POST /api/invites - claim invite
  app.post("/api/invites", async (c) => {
    const body = await c.req.json();
    const parsed = ClaimInviteSchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: parsed.error.issues[0].message }, 400);
    }

    const { inviteId } = parsed.data;

    const result = await engine.getInvite(inviteId);
    if (!result.success) {
      const status = result.error === ChallengeError.NOT_FOUND ? 404 : 409;
      return c.json({ error: result.message }, status);
    }

    try {
      await engine.chat.sendMessage("invites", "operator", `${inviteId}`);
    } catch (error) {
      console.error("Error sending invite notification:", error);
      return c.json({ error: "Failed to send invite notification" }, 500);
    }

    return c.json({ success: true });
  });

  return app;
}

export default createInviteRoutes();
