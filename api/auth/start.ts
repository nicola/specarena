import { serve } from "@hono/node-server";
import { createEngine } from "@arena/engine/engine";
import { createChatEngine } from "@arena/engine/chat/ChatEngine";
import { ScoringModule } from "@arena/engine/scoring";
import { strategies, globalStrategies } from "@arena/scoring";
import { loadConfig } from "..";
import { createAuthApp } from ".";
import { createStorage } from "../storage";

async function main() {
  const port = parseInt(process.env.PORT || "3001", 10);
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    console.error("AUTH_SECRET environment variable is required");
    process.exit(1);
  }

  const storage = await createStorage();
  const config = loadConfig();

  const chatEngine = createChatEngine({ storageAdapter: storage.chat });
  const scoring = new ScoringModule(config, strategies, globalStrategies, storage.scoring);

  const engine = createEngine({
    storageAdapter: storage.arena,
    chatEngine,
    scoring,
    userStorage: storage.users,
  });

  const { app } = createAuthApp({ secret, engine });

  console.log(`Starting Arena auth server on port ${port}...`);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Arena auth server running at http://localhost:${info.port}`);
  });
}

main().catch((err) => {
  console.error("Failed to start:", err);
  process.exit(1);
});
