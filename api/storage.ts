import { mkdirSync } from "fs";
import { dirname, resolve } from "path";
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
  close?: () => Promise<void>;
}

function isSqlStorageMode(mode: string): boolean {
  return mode === "sql" || mode === "sqlite";
}

export async function createStorage(): Promise<StorageAdapters> {
  const mode = process.env.STORAGE ?? "memory";

  if (isSqlStorageMode(mode)) {
    const dbPath = resolve(process.env.SQLITE_PATH ?? "./data/arena.db");
    mkdirSync(dirname(dbPath), { recursive: true });

    const sqliteDb = new Database(dbPath);
    sqliteDb.pragma("journal_mode = WAL");
    sqliteDb.pragma("foreign_keys = ON");

    const db = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({ database: sqliteDb }),
    });

    const migrator = new Migrator({
      db,
      provider: new StaticMigrationProvider(),
    });
    const { error } = await migrator.migrateToLatest();
    if (error) {
      throw error;
    }

    console.log(`Using SQL storage (${dbPath})`);

    return {
      arena: new SqlArenaStorageAdapter(db),
      chat: new SqlChatStorageAdapter(db),
      users: new SqlUserStorageAdapter(db),
      scoring: new SqlScoringStorageAdapter(db),
      close: async () => {
        await db.destroy();
        sqliteDb.close();
      },
    };
  }

  return {
    arena: new InMemoryArenaStorageAdapter(),
    chat: new InMemoryChatStorageAdapter(),
    users: new InMemoryUserStorageAdapter(),
    scoring: new InMemoryScoringStore(),
  };
}
