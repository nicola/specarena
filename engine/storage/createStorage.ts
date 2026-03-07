import type { ArenaStorageAdapter, ChatStorageAdapter, UserStorageAdapter } from "./types";
import type { ScoringStorageAdapter } from "@arena/scoring";
import { InMemoryArenaStorageAdapter } from "./InMemoryArenaStorageAdapter";
import { InMemoryChatStorageAdapter } from "./InMemoryChatStorageAdapter";
import { InMemoryUserStorageAdapter } from "../users/index";

export interface StorageAdapters {
  arena: ArenaStorageAdapter;
  chat: ChatStorageAdapter;
  user: UserStorageAdapter;
  scoring?: ScoringStorageAdapter;
}

export function createInMemoryStorage(): StorageAdapters {
  return {
    arena: new InMemoryArenaStorageAdapter(),
    chat: new InMemoryChatStorageAdapter(),
    user: new InMemoryUserStorageAdapter(),
  };
}

let _sqlModule: typeof import("./sql/index") | undefined;

function getSqlModule(): typeof import("./sql/index") {
  if (!_sqlModule) {
    // Synchronous require avoids top-level await; pg/kysely are only loaded when DATABASE_URL is set
    _sqlModule = require("./sql/index");
  }
  return _sqlModule!;
}

export function createStorage(): StorageAdapters {
  const databaseUrl = process.env.DATABASE_URL;

  if (databaseUrl) {
    const { createSqlStorage } = getSqlModule();
    const sql = createSqlStorage(databaseUrl);
    console.log("[storage] Using PostgreSQL");
    return { arena: sql.arena, chat: sql.chat, user: sql.user, scoring: sql.scoring };
  }

  console.log("[storage] Using in-memory storage");
  return createInMemoryStorage();
}
