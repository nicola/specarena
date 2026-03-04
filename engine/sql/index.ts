import { Kysely, Migrator } from "kysely";
import type { Dialect } from "kysely";
import type { Database } from "./db";
import { ArenaMigrationProvider } from "./migrations";

export { SqlChatStorageAdapter } from "./SqlChatStorageAdapter";
export { SqlUserStorageAdapter } from "./SqlUserStorageAdapter";
export { SqlScoringStorageAdapter } from "./SqlScoringStorageAdapter";
export { ArenaMigrationProvider } from "./migrations";
export type { Database } from "./db";

export function createDatabase(dialect: Dialect): Kysely<Database> {
  return new Kysely<Database>({ dialect });
}

export async function migrateToLatest(db: Kysely<Database>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: new ArenaMigrationProvider(),
  });

  const { error } = await migrator.migrateToLatest();
  if (error) throw error;
}
