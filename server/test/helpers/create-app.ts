import { Hono } from "hono";
import { ArenaEngine, createEngine } from "@arena/engine/engine";
import { createApp } from "../../index";
import type { StorageAdapters } from "@arena/engine/storage/createStorage";

export interface TestApp {
  app: Hono;
  engine: ArenaEngine;
}

export function createTestApp(storage?: StorageAdapters): TestApp {
  const engine = storage
    ? createEngine({
        storageAdapter: storage.arena,
        chatStorageAdapter: storage.chat,
        userStorage: storage.user,
      })
    : createEngine();
  const app = createApp(engine);
  return { app, engine };
}

/**
 * Creates test app based on TEST_DB env var.
 * TEST_DB=pglite → isolated PGlite database per call.
 * Otherwise → in-memory (default).
 */
export async function createTestAppFromEnv(): Promise<TestApp> {
  if (process.env.TEST_DB === "pglite") {
    const { PGlite } = await import("@electric-sql/pglite");
    const { Kysely } = await import("kysely");
    const { PGliteDialect } = await import("kysely-pglite-dialect");
    const { up, SqlArenaStorageAdapter, SqlChatStorageAdapter, SqlUserStorageAdapter } =
      await import("@arena/engine/storage/sql");

    const client = new PGlite();
    await client.waitReady;
    const db = new Kysely<any>({ dialect: new PGliteDialect(client) });
    await up(db);

    return createTestApp({
      arena: new SqlArenaStorageAdapter(db),
      chat: new SqlChatStorageAdapter(db),
      user: new SqlUserStorageAdapter(db),
    });
  }
  return createTestApp();
}
