import { mkdirSync } from "fs";
import { dirname } from "path";
import { Kysely, Migrator, SqliteDialect } from "kysely";
import Database from "better-sqlite3";
import {
  type Database as DatabaseSchema,
  StaticMigrationProvider,
  SqlArenaStorageAdapter,
  SqlChatStorageAdapter,
  SqlUserStorageAdapter,
  SqlScoringStorageAdapter,
} from "@arena/engine/storage/sql";
import { InMemoryArenaStorageAdapter } from "@arena/engine/storage/InMemoryArenaStorageAdapter";
import { InMemoryChatStorageAdapter } from "@arena/engine/storage/InMemoryChatStorageAdapter";
import { InMemoryUserStorageAdapter } from "@arena/engine/users";
import { InMemoryScoringStore } from "@arena/scoring";
import type { ArenaStorageAdapter } from "@arena/engine/storage/InMemoryArenaStorageAdapter";
import type { ChatStorageAdapter } from "@arena/engine/storage/InMemoryChatStorageAdapter";
import type { UserStorageAdapter } from "@arena/engine/users";
import type { ScoringStorageAdapter } from "@arena/scoring";

export interface StorageAdapters {
  arena: ArenaStorageAdapter;
  chat: ChatStorageAdapter;
  users: UserStorageAdapter;
  scoring: ScoringStorageAdapter;
}

export async function createStorage(): Promise<StorageAdapters> {
  const mode = process.env.STORAGE ?? "memory";

  if (mode === "sqlite") {
    const dbPath = process.env.SQLITE_PATH ?? "./data/arena.db";
    mkdirSync(dirname(dbPath), { recursive: true });
    const sqliteDb = new Database(dbPath);
    sqliteDb.pragma("journal_mode = WAL");
    sqliteDb.pragma("foreign_keys = ON");

    const db = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({ database: sqliteDb }),
    });

    // Run migrations
    const migrator = new Migrator({
      db,
      provider: new StaticMigrationProvider(),
    });
    const { error } = await migrator.migrateToLatest();
    if (error) {
      throw new Error(`Migration failed: ${error}`);
    }

    console.log("Using SQLite storage:", dbPath);

    return {
      arena: new SqlArenaStorageAdapter(db),
      chat: new SqlChatStorageAdapter(db),
      users: new SqlUserStorageAdapter(db),
      scoring: new SqlScoringStorageAdapter(db),
    };
  }

  // Default: in-memory
  return {
    arena: new InMemoryArenaStorageAdapter(),
    chat: new InMemoryChatStorageAdapter(),
    users: new InMemoryUserStorageAdapter(),
    scoring: new InMemoryScoringStore(),
  };
}
