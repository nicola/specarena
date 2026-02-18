import { readFileSync } from "fs";
import { join } from "path";
import { Hono } from "hono";
import { registerChallengeFactory, registerChallengeMetadata } from "./storage/challenges";
import { ChallengeConfig, ChallengeMetadata } from "./types";
import { registry } from "@arena/challenges";
import { createArenaHandler } from "./api/arena";
import { createChatHandler } from "./api/chat";
import challengeRoutes from "./routes/challenges";
import inviteRoutes from "./routes/invites";
import chatRoutes from "./routes/chat";

// --- Register challenges ---

const configs: ChallengeConfig[] = JSON.parse(
  readFileSync(join(__dirname, "challenges.json"), "utf-8")
);

const challengesDir = join(__dirname, "..", "challenges");

for (const config of configs) {
  const metadata: ChallengeMetadata = JSON.parse(
    readFileSync(join(challengesDir, config.name, "challenge.json"), "utf-8")
  );
  registerChallengeMetadata(config.name, metadata);

  const factory = registry[config.name];
  if (factory) {
    registerChallengeFactory(config.name, factory, config.options);
  }
}

// --- Create Hono app ---

const app = new Hono();

// Mount REST routes
app.route("/", challengeRoutes);
app.route("/", inviteRoutes);
app.route("/", chatRoutes);

// Mount MCP handlers
const arenaHandler = createArenaHandler({ basePath: "/api/arena" });
const chatHandler = createChatHandler({ basePath: "/api/chat" });

app.all("/api/arena/*", (c) => arenaHandler(c.req.raw));
app.all("/api/chat/*", (c) => chatHandler(c.req.raw));

export default app;
