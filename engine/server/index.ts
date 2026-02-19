import { readFileSync } from "fs";
import { join } from "path";
import { Hono } from "hono";
import { registerChallengeFactory, registerChallengeMetadata } from "../storage/challenges";
import { ChallengeConfig, ChallengeFactory, ChallengeMetadata } from "../types";
import { createArenaHandler } from "./mcp/arena";
import { createChatHandler } from "./mcp/chat";
import challengeRoutes from "./routes/challenges";
import inviteRoutes from "./routes/invites";
import chatRoutes from "./routes/chat";
import arenaRoutes from "./routes/arena";

// --- Register challenges from challenges.json ---

const configs: ChallengeConfig[] = JSON.parse(
  readFileSync(join(__dirname, "..", "challenges.json"), "utf-8")
);

const challengesDir = join(__dirname, "..", "..", "challenges");

for (const config of configs) {
  const metadata: ChallengeMetadata = JSON.parse(
    readFileSync(join(challengesDir, config.name, "challenge.json"), "utf-8")
  );
  registerChallengeMetadata(config.name, metadata);

  // Dynamic import: each challenge exports a createChallenge factory
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require(join(challengesDir, config.name, "index.ts")) as { createChallenge: ChallengeFactory };
  if (mod.createChallenge) {
    registerChallengeFactory(config.name, mod.createChallenge, config.options);
  }
}

// --- Create Hono app ---

const app = new Hono();

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

// Mount REST routes
app.route("/", challengeRoutes);
app.route("/", inviteRoutes);
app.route("/", chatRoutes);
app.route("/", arenaRoutes);

// Mount MCP handlers
const arenaHandler = createArenaHandler({ basePath: "/api/arena" });
const chatHandler = createChatHandler({ basePath: "/api/chat" });

app.all("/api/arena/mcp", (c) => arenaHandler(c.req.raw));
app.all("/api/arena/sse", (c) => arenaHandler(c.req.raw));
app.all("/api/arena/message", (c) => arenaHandler(c.req.raw));
app.all("/api/chat/mcp", (c) => chatHandler(c.req.raw));
app.all("/api/chat/sse", (c) => chatHandler(c.req.raw));
app.all("/api/chat/message", (c) => chatHandler(c.req.raw));

export default app;
