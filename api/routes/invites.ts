import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "@arena/engine/engine";
import { ChallengeError } from "@arena/engine/types";

function toInviteStatusResponse(inviteId: string, challengeId: string, challengeType: string, createdAt: number, playerCount: number) {
  return {
    inviteId,
    challengeId,
    challengeType,
    createdAt,
    playerCount,
  };
}

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

    return c.json(
      toInviteStatusResponse(
        inviteId,
        result.data.id,
        result.data.challengeType,
        result.data.createdAt,
        result.data.playerCount,
      ),
    );
  });

  // POST /api/invites - claim invite
  app.post("/api/invites", async (c) => {
    const body = await c.req.json();
    const { inviteId } = body;

    if (!inviteId) {
      return c.json({ error: "inviteId is required" }, 400);
    }

    const result = await engine.getInvite(inviteId);
    if (!result.success) {
      const status = result.error === ChallengeError.NOT_FOUND ? 404 : 409;
      return c.json({ error: result.message }, status);
    }

    await engine.chat.sendMessage("invites", "operator", `${inviteId}`);

    return c.json({ success: true });
  });

  return app;
}

export default createInviteRoutes();
