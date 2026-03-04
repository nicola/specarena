import type { Migration, MigrationProvider } from "kysely";

const migrations: Record<string, Migration> = {
  "001_initial": {
    async up(db) {
      // Chat
      await db.schema
        .createTable("chat_messages")
        .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
        .addColumn("channel", "text", (col) => col.notNull())
        .addColumn("idx", "integer", (col) => col.notNull())
        .addColumn("from_id", "text", (col) => col.notNull())
        .addColumn("to_id", "text")
        .addColumn("content", "text", (col) => col.notNull())
        .addColumn("timestamp", "integer", (col) => col.notNull())
        .addColumn("type", "text")
        .addColumn("redacted", "integer", (col) => col.notNull().defaultTo(0))
        .execute();

      await db.schema
        .createIndex("idx_chat_messages_channel")
        .on("chat_messages")
        .column("channel")
        .execute();

      await db.schema
        .createTable("channel_counters")
        .addColumn("channel", "text", (col) => col.primaryKey().notNull())
        .addColumn("counter", "integer", (col) => col.notNull().defaultTo(0))
        .execute();

      // Users
      await db.schema
        .createTable("users")
        .addColumn("user_id", "text", (col) => col.primaryKey().notNull())
        .addColumn("username", "text")
        .addColumn("model", "text")
        .execute();

      // Scoring
      await db.schema
        .createTable("score_entries")
        .addColumn("challenge_type", "text", (col) => col.notNull())
        .addColumn("strategy_name", "text", (col) => col.notNull())
        .addColumn("player_id", "text", (col) => col.notNull())
        .addColumn("games_played", "integer", (col) => col.notNull().defaultTo(0))
        .addColumn("metrics", "text", (col) => col.notNull().defaultTo("{}"))
        .addPrimaryKeyConstraint("pk_score_entries", [
          "challenge_type",
          "strategy_name",
          "player_id",
        ])
        .execute();

      await db.schema
        .createTable("global_score_entries")
        .addColumn("player_id", "text", (col) => col.primaryKey().notNull())
        .addColumn("games_played", "integer", (col) => col.notNull().defaultTo(0))
        .addColumn("metrics", "text", (col) => col.notNull().defaultTo("{}"))
        .execute();

      await db.schema
        .createTable("strategy_state")
        .addColumn("challenge_type", "text", (col) => col.notNull())
        .addColumn("strategy_name", "text", (col) => col.notNull())
        .addColumn("player_id", "text", (col) => col.notNull())
        .addColumn("state", "text", (col) => col.notNull().defaultTo("{}"))
        .addPrimaryKeyConstraint("pk_strategy_state", [
          "challenge_type",
          "strategy_name",
          "player_id",
        ])
        .execute();

      await db.schema
        .createTable("global_strategy_state")
        .addColumn("player_id", "text", (col) => col.primaryKey().notNull())
        .addColumn("state", "text", (col) => col.notNull().defaultTo("{}"))
        .execute();
    },
    async down(db) {
      for (const table of [
        "global_strategy_state",
        "strategy_state",
        "global_score_entries",
        "score_entries",
        "users",
        "channel_counters",
        "chat_messages",
      ] as const) {
        await db.schema.dropTable(table).ifExists().execute();
      }
    },
  },
};

export class ArenaMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return migrations;
  }
}
