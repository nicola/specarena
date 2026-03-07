import { Kysely } from "kysely";
import { PGlite } from "@electric-sql/pglite";
import { PGliteDialect } from "kysely-pglite-dialect";
import type { Database } from "../../storage/sql/schema";
import { up, down } from "../../storage/sql/migrations";
import { SqlArenaStorageAdapter } from "../../storage/sql/SqlArenaStorageAdapter";
import { SqlChatStorageAdapter } from "../../storage/sql/SqlChatStorageAdapter";
import { SqlUserStorageAdapter } from "../../storage/sql/SqlUserStorageAdapter";
import type { ArenaStorageAdapter, ChatStorageAdapter, UserStorageAdapter } from "../../storage/types";

export interface TestStorage {
  arena: ArenaStorageAdapter;
  chat: ChatStorageAdapter;
  user: UserStorageAdapter;
  db: Kysely<Database>;
  cleanup: () => Promise<void>;
}

export async function createTestDb(): Promise<TestStorage> {
  const client = new PGlite();
  await client.waitReady;
  const db = new Kysely<Database>({
    dialect: new PGliteDialect(client),
  });

  await up(db);

  return {
    arena: new SqlArenaStorageAdapter(db),
    chat: new SqlChatStorageAdapter(db),
    user: new SqlUserStorageAdapter(db),
    db,
    cleanup: async () => {
      await db.destroy();
      await client.close();
    },
  };
}

/** Reset all table data (faster than drop+recreate) */
export async function resetTestDb(db: Kysely<Database>): Promise<void> {
  // Delete in order respecting FK constraints
  await db.deleteFrom("scoring_strategy_state").execute();
  await db.deleteFrom("scoring_metrics").execute();
  await db.deleteFrom("scoring_attributions").execute();
  await db.deleteFrom("game_scores").execute();
  await db.deleteFrom("chat_messages").execute();
  await db.deleteFrom("challenge_invites").execute();
  await db.deleteFrom("challenges").execute();
  await db.deleteFrom("users").execute();
}
