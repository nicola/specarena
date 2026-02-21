import { readFileSync } from "fs";
import { join } from "path";
import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../engine";
import { ChallengeConfig, ChallengeFactory, ChallengeMetadata } from "../types";
import { sessionAuth } from "../auth/index";
import { createArenaHandler } from "./mcp/arena";
import { createChatHandler } from "./mcp/chat";
import { createChallengeRoutes } from "./routes/challenges";
import { createInviteRoutes } from "./routes/invites";
import { createChatRoutes } from "./routes/chat";
import { createArenaRoutes } from "./routes/arena";

export function registerChallengesFromConfig(engine: ArenaEngine): void {
  const configs: ChallengeConfig[] = JSON.parse(
    readFileSync(join(__dirname, "..", "challenges.json"), "utf-8")
  );

  const challengesDir = join(__dirname, "..", "..", "challenges");

  for (const config of configs) {
    const metadata: ChallengeMetadata = JSON.parse(
      readFileSync(join(challengesDir, config.name, "challenge.json"), "utf-8")
    );
    engine.registerChallengeMetadata(config.name, metadata);

    // Dynamic import: each challenge exports a createChallenge factory
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(join(challengesDir, config.name, "index.ts")) as { createChallenge: ChallengeFactory };
    if (mod.createChallenge) {
      engine.registerChallengeFactory(config.name, mod.createChallenge, config.options);
    }
  }
}

export function createApp(engine: ArenaEngine = defaultEngine): Hono {
  registerChallengesFromConfig(engine);
  const app = new Hono();
  const authMiddleware = sessionAuth((token, cid) => engine.resolveSession(token, cid));

  // Global error handler — catches malformed JSON, unexpected throws, etc.
  app.onError((err, c) => {
    if (err.message.includes("JSON")) {
      return c.json({ error: "Invalid JSON in request body" }, 400);
    }
    console.error("Unhandled error:", err);
    return c.json({ error: err.message }, 500);
  });

  // /api/v1/* → rewrite to /api/* (v1 is the canonical path, /api kept for compatibility)
  app.all("/api/v1/*", (c) => {
    const url = new URL(c.req.url);
    url.pathname = url.pathname.replace(/^\/api\/v1/, "/api");
    return app.fetch(new Request(url.toString(), c.req.raw));
  });

  // Session auth on protected arena + chat routes
  app.post("/api/arena/message", authMiddleware);
  app.get("/api/arena/sync", authMiddleware);
  app.post("/api/chat/send", authMiddleware);
  app.get("/api/chat/sync", authMiddleware);

  // Mount REST routes
  app.route("/", createChallengeRoutes(engine));
  app.route("/", createInviteRoutes(engine));
  app.route("/", createChatRoutes(engine.chat, engine.auth));
  app.route("/", createArenaRoutes(engine));

  // Mount MCP handlers
  const arenaHandler = createArenaHandler({ basePath: "/api/arena", engine });
  const chatHandler = createChatHandler({ basePath: "/api/chat", engine });

  app.all("/api/arena/mcp", (c) => arenaHandler(c.req.raw));
  app.all("/api/arena/sse", (c) => arenaHandler(c.req.raw));
  app.all("/api/arena/message", (c) => arenaHandler(c.req.raw));
  app.all("/api/chat/mcp", (c) => chatHandler(c.req.raw));
  app.all("/api/chat/sse", (c) => chatHandler(c.req.raw));
  app.all("/api/chat/message", (c) => chatHandler(c.req.raw));

  return app;
}

const app = createApp();
export default app;
