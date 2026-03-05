import { Kysely, Migrator, SqliteDialect } from "kysely";
import Database from "better-sqlite3";
import type { Database as DatabaseSchema } from "../schema";
import { StaticMigrationProvider } from "../migrations";

export function createTestDb() {
  const sqliteDb = new Database(":memory:");
  sqliteDb.pragma("foreign_keys = ON");
  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({ database: sqliteDb }),
  });
}

export async function migrate(db: Kysely<DatabaseSchema>) {
  const migrator = new Migrator({
    db,
    provider: new StaticMigrationProvider(),
  });
  const { error } = await migrator.migrateToLatest();
  if (error) throw error;
}
