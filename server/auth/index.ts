import { Hono } from "hono";
import { ArenaEngine, createEngine } from "@specarena/engine/engine";
import {
  registerChallengesFromConfig,
  createApp,
} from "../index";
import { AuthEngine } from "./AuthEngine";
import { generateSecret, hashPublicKey } from "./utils";
import { createAuthUser } from "./middleware";

export interface AuthAppOptions {
  secret?: string;
  engine?: ArenaEngine;
}

export function createAuthApp(options: AuthAppOptions = {}) {
  const secret = options.secret ?? generateSecret();
  const engine = options.engine ?? createEngine();
  const auth = new AuthEngine(secret);

  const app = new Hono();

  // Global error handler
  app.onError((err, c) => {
    if (err.message.includes("JSON")) {
      return c.json({ error: "Invalid JSON in request body" }, 400);
    }
    console.error("Unhandled error:", err);
    return c.json({ error: err.message }, 500);
  });

  // /api/v1/* → rewrite to /api/*
  app.all("/api/v1/*", (c) => {
    const url = new URL(c.req.url);
    url.pathname = url.pathname.replace(/^\/api\/v1/, "/api");
    return app.fetch(new Request(url.toString(), c.req.raw));
  });

  // Permissive auth: sets identity for all routes
  app.use("*", createAuthUser(engine, auth));

  // Ad-hoc join: verify Ed25519 signature, call engine.challengeJoin(), mint session key
  app.post("/api/arena/join", async (c) => {
    const body = await c.req.json();
    const { invite, publicKey, signature, timestamp } = body;

    if (!invite) {
      return c.json({ error: "invite is required" }, 400);
    }
    if (!publicKey || !signature || !timestamp) {
      return c.json({ error: "publicKey, signature, and timestamp are required" }, 400);
    }

    const authResult = auth.authenticateJoin(publicKey, signature, invite, timestamp);
    if (!authResult.valid) {
      return c.json({ error: authResult.reason }, 401);
    }

    const userId = hashPublicKey(publicKey);
    const result = await engine.challengeJoin(invite, userId);
    if ("error" in result) {
      return c.json(result, 400);
    }

    // Find userIndex for this invite to create session key
    const challenge = await engine.getChallengeFromInvite(invite);
    if (!challenge.success) {
      return c.json({ error: "Challenge not found for invite" }, 404);
    }
    const userIndex = challenge.data.state.players.indexOf(invite);
    if (userIndex === -1) {
      return c.json({ error: "Invite not found in challenge players" }, 400);
    }
    const sessionKey = auth.createSessionKey(challenge.data.id, userIndex);

    return c.json({ ...result, sessionKey });
  });

  // Signed user profile update
  app.post("/api/users", async (c) => {
    const body = await c.req.json();
    const { publicKey, signature, timestamp, username, model } = body;

    if (!publicKey || !signature || !timestamp) {
      return c.json({ error: "publicKey, signature, and timestamp are required" }, 400);
    }

    const authResult = auth.authenticateUserUpdate(publicKey, signature, timestamp);
    if (!authResult.valid) {
      return c.json({ error: authResult.reason }, 401);
    }

    const userId = hashPublicKey(publicKey);
    const user = await engine.users.setUser(userId, { username, model });
    return c.json(user);
  });

  // Mount engine app (includes identity resolution middleware + all routes)
  app.route("/", createApp(engine, { mcp: false }));

  return { app, engine, auth };
}
