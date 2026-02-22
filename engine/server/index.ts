import { readFileSync } from "fs";
import { join } from "path";
import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "../engine";
import { ChallengeConfig, ChallengeFactory, ChallengeMetadata } from "../types";
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

  // Global error handler — catches malformed JSON, unexpected throws, etc.
  app.onError((err, c) => {
    if (err instanceof SyntaxError || err.message.includes("JSON")) {
      return c.json({ error: "Invalid JSON in request body" }, 400);
    }
    console.error("Unhandled error:", err);
    return c.json({ error: "Internal server error" }, 500);
  });

  // /api/v1/* → rewrite to /api/* (v1 is the canonical path, /api kept for compatibility)
  app.all("/api/v1/*", (c) => {
    const url = new URL(c.req.url);
    url.pathname = url.pathname.replace(/^\/api\/v1/, "/api");
    return app.fetch(new Request(url.toString(), c.req.raw));
  });

  // Mount REST routes
  app.route("/", createChallengeRoutes(engine));
  app.route("/", createInviteRoutes(engine));
  app.route("/", createChatRoutes(engine));
  app.route("/", createArenaRoutes(engine));

  // Mount MCP handlers on distinct /api/mcp/* paths to avoid shadowing REST routes
  const arenaHandler = createArenaHandler({ basePath: "/api/mcp/arena", engine });
  const chatHandler = createChatHandler({ basePath: "/api/mcp/chat", engine });

  app.all("/api/mcp/arena/mcp", (c) => arenaHandler(c.req.raw));
  app.all("/api/mcp/arena/sse", (c) => arenaHandler(c.req.raw));
  app.all("/api/mcp/arena/message", (c) => arenaHandler(c.req.raw));
  app.all("/api/mcp/chat/mcp", (c) => chatHandler(c.req.raw));
  app.all("/api/mcp/chat/sse", (c) => chatHandler(c.req.raw));
  app.all("/api/mcp/chat/message", (c) => chatHandler(c.req.raw));

  return app;
}

const app = createApp();
export default app;
