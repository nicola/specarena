import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../../engine";

export function createAuthRoutes(engine: ArenaEngine = defaultEngine) {
  const app = new Hono();

  // POST /api/auth/nonce - issue a short-lived nonce used to prove did:key ownership at join time.
  app.post("/api/auth/nonce", async (c) => {
    const body = await c.req.json();
    const { invite, purpose } = body ?? {};

    if (purpose !== "join") {
      return c.json({ error: "purpose must be 'join'" }, 400);
    }
    if (!invite) {
      return c.json({ error: "invite is required" }, 400);
    }

    const nonce = engine.auth.issueJoinNonce(invite);
    return c.json({
      ...nonce,
      proofRequired: engine.auth.isJoinProofRequired(),
    });
  });

  return app;
}

export default createAuthRoutes();
