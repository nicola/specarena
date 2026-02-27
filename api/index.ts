import { readFileSync } from "fs";
import { join } from "path";
import { Hono } from "hono";
import { ArenaEngine, defaultEngine } from "@arena/engine/engine";
import { ChallengeFactory, ChallengeMetadata } from "@arena/engine/types";
import { ScoringModule } from "@arena/engine/scoring";
import type { EngineConfig } from "@arena/engine/scoring/types";
import { strategies, globalStrategies } from "@arena/scoring";
import { createArenaHandler } from "./mcp/arena";
import { createChatHandler } from "./mcp/chat";
import { createChallengeRoutes } from "./routes/challenges";
import { createInviteRoutes } from "./routes/invites";
import { createChatRoutes } from "./routes/chat";
import { createArenaRoutes } from "./routes/arena";
import { createResolveIdentity } from "./routes/identity";
import { createScoringRoutes } from "./routes/scoring";
import { createUserRoutes } from "./routes/users";

export { createArenaRoutes } from "./routes/arena";
export { createChatRoutes } from "./routes/chat";
export { createChallengeRoutes } from "./routes/challenges";
export { createInviteRoutes } from "./routes/invites";
export { createResolveIdentity } from "./routes/identity";
export { createScoringRoutes } from "./routes/scoring";
export { createUserRoutes } from "./routes/users";

export function loadConfig(): EngineConfig {
  return JSON.parse(
    readFileSync(join(__dirname, "config.json"), "utf-8")
  );
}

export function registerChallengesFromConfig(engine: ArenaEngine, config?: EngineConfig): void {
  const configs = config ?? loadConfig();
  const challengesDir = join(__dirname, "..", "challenges");

  for (const entry of configs.challenges) {
    const metadata: ChallengeMetadata = JSON.parse(
      readFileSync(join(challengesDir, entry.name, "challenge.json"), "utf-8")
    );
    engine.registerChallengeMetadata(entry.name, metadata);

    // Dynamic import: each challenge exports a createChallenge factory
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(join(challengesDir, entry.name, "index.ts")) as { createChallenge: ChallengeFactory };
    if (mod.createChallenge) {
      engine.registerChallengeFactory(entry.name, mod.createChallenge, entry.options);
    }
  }
}

export function createApp(engine: ArenaEngine = defaultEngine, options?: { mcp?: boolean }): Hono {
  const mcp = options?.mcp ?? true;

  // Load config and initialize scoring
  const config = loadConfig();
  if (!engine.scoring) {
    engine.scoring = new ScoringModule(config, strategies, globalStrategies);
  }
  registerChallengesFromConfig(engine, config);
  const app = new Hono();

  // Health check (before any middleware)
  app.get("/health", (c) => c.json({ status: "ok" }));

  // Serve SKILL.md
  app.get("/skill.md", (c) => {
    const skillPath = join(__dirname, "..", "SKILL.md");
    const content = readFileSync(skillPath, "utf-8");
    return c.text(content);
  });

  // Global error handler — catches malformed JSON, unexpected throws, etc.
  app.onError((err, c) => {
    if (err.message.includes("JSON")) {
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

  // Resolve identity from query/body params (standalone mode)
  app.use("*", createResolveIdentity());

  // Mount REST routes
  app.route("/", createChallengeRoutes(engine));
  app.route("/", createInviteRoutes(engine));
  app.route("/", createChatRoutes(engine));
  app.route("/", createArenaRoutes(engine));
  app.route("/", createScoringRoutes(engine));
  app.route("/", createUserRoutes(engine));

  // Mount MCP handlers
  if (mcp) {
    const arenaHandler = createArenaHandler({ basePath: "/api/arena", engine });
    const chatHandler = createChatHandler({ basePath: "/api/chat", chat: engine.chat });

    app.all("/api/arena/mcp", (c) => arenaHandler(c.req.raw));
    app.all("/api/arena/sse", (c) => arenaHandler(c.req.raw));
    app.all("/api/arena/message", (c) => arenaHandler(c.req.raw));
    app.all("/api/chat/mcp", (c) => chatHandler(c.req.raw));
    app.all("/api/chat/sse", (c) => chatHandler(c.req.raw));
    app.all("/api/chat/message", (c) => chatHandler(c.req.raw));
  }

  return app;
}

const app = createApp();
export default app;
