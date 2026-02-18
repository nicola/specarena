import { readFileSync } from "fs";
import { join } from "path";
import { Hono } from "hono";
import { registerChallengeFactory, registerChallengeMetadata } from "./storage/challenges";
import { ChallengeConfig, ChallengeFactory, ChallengeMetadata } from "./types";
import { createArenaHandler } from "./api/arena";
import { createChatHandler } from "./api/chat";
import challengeRoutes from "./routes/challenges";
import inviteRoutes from "./routes/invites";
import chatRoutes from "./routes/chat";
import arenaRoutes from "./routes/arena";

// --- Register challenges from challenges.json ---

const configs: ChallengeConfig[] = JSON.parse(
  readFileSync(join(__dirname, "challenges.json"), "utf-8")
);

const challengesDir = join(__dirname, "..", "challenges");

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

// Mount REST routes
app.route("/", challengeRoutes);
app.route("/", inviteRoutes);
app.route("/", chatRoutes);
app.route("/", arenaRoutes);

// Mount MCP handlers
const arenaHandler = createArenaHandler({ basePath: "/api/arena" });
const chatHandler = createChatHandler({ basePath: "/api/chat" });

app.all("/api/arena/*", (c) => arenaHandler(c.req.raw));
app.all("/api/chat/*", (c) => chatHandler(c.req.raw));

export default app;
