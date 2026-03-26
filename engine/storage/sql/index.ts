import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import type { Database } from "./schema";
import { SqlArenaStorageAdapter } from "./SqlArenaStorageAdapter";
import { SqlChatStorageAdapter } from "./SqlChatStorageAdapter";
import { SqlUserStorageAdapter } from "./SqlUserStorageAdapter";
import { SqlScoringStorageAdapter } from "@specarena/scoring/sql";
import type { ArenaStorageAdapter, ChatStorageAdapter, UserStorageAdapter } from "../types";
import type { ScoringStorageAdapter } from "@specarena/scoring";

export interface SqlStorage {
  arena: ArenaStorageAdapter;
  chat: ChatStorageAdapter;
  user: UserStorageAdapter;
  scoring: ScoringStorageAdapter;
  db: Kysely<Database>;
}

export function createSqlStorage(connectionString: string): SqlStorage {
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString }),
    }),
  });

  return {
    arena: new SqlArenaStorageAdapter(db),
    chat: new SqlChatStorageAdapter(db),
    user: new SqlUserStorageAdapter(db),
    scoring: new SqlScoringStorageAdapter(db),
    db,
  };
}

export { SqlArenaStorageAdapter } from "./SqlArenaStorageAdapter";
export { SqlChatStorageAdapter } from "./SqlChatStorageAdapter";
export { SqlUserStorageAdapter } from "./SqlUserStorageAdapter";
export type { Database } from "./schema";
export { up, down } from "./migrations";
