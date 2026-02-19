import { Hono } from "hono";
import { getInvite, ChallengeError } from "../../storage/challenges";
import { sendMessage } from "../../storage/chat";

const app = new Hono();

// GET /api/invites/:inviteId - get invite status
app.get("/api/invites/:inviteId", (c) => {
  const inviteId = c.req.param("inviteId");
  const result = getInvite(inviteId);

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
  const { inviteId } = body;

  if (!inviteId) {
    return c.json({ error: "inviteId is required" }, 400);
  }

  const result = getInvite(inviteId);
  if (!result.success) {
    const status = result.error === ChallengeError.NOT_FOUND ? 404 : 409;
    return c.json({ error: result.message }, status);
  }

  sendMessage("invites", "operator", `${inviteId}`);

  return c.json({ success: true });
});

export default app;
