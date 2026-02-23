import { serve } from "@hono/node-server";
import { createApp } from ".";
import { createEngine } from "../engine";
import { createChatEngine } from "../chat/ChatEngine";

const port = parseInt(process.env.PORT || "3001", 10);

async function main() {
  let engine;

  if (process.env.STORAGE === "sqlite") {
    const Database = (await import("better-sqlite3")).default;
    const { SqliteChatStorageAdapter } = await import("../storage/SqliteChatStorageAdapter");
    const { SqliteArenaStorageAdapter } = await import("../storage/SqliteArenaStorageAdapter");

    const db = new Database(process.env.SQLITE_PATH || "arena.db");
    db.pragma("journal_mode = WAL");
    const chatStorage = new SqliteChatStorageAdapter(db);
    const arenaStorage = new SqliteArenaStorageAdapter(db);
    const chatEngine = createChatEngine({ storageAdapter: chatStorage });
    engine = createEngine({ storageAdapter: arenaStorage, chatEngine });
  } else {
    engine = createEngine();
  }

  const app = createApp(engine);
  await engine.loadChallenges();

  console.log(`Starting Arena engine server on port ${port}...`);
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`Arena engine server running at http://localhost:${info.port}`);
  });
}

main();
