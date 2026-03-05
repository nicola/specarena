import type { Kysely, Migration, MigrationProvider } from "kysely";

const migration001: Migration = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable("challenges")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("challenge_type", "text", (col) => col.notNull())
      .addColumn("created_at", "integer", (col) => col.notNull())
      .addColumn("status", "text", (col) => col.notNull().defaultTo("pending"))
      .addColumn("completed_at", "integer")
      .execute();

    await db.schema
      .createIndex("idx_challenges_type")
      .on("challenges")
      .columns(["challenge_type", "created_at"])
      .execute();

    await db.schema
      .createTable("challenge_invites")
      .addColumn("invite", "text", (col) => col.primaryKey())
      .addColumn("challenge_id", "text", (col) =>
        col.notNull().references("challenges.id").onDelete("cascade")
      )
      .addColumn("player_index", "integer", (col) => col.notNull())
      .addColumn("user_id", "text")
      .addUniqueConstraint("uq_challenge_invites_player", ["challenge_id", "player_index"])
      .execute();

    await db.schema
      .createIndex("idx_invites_challenge")
      .on("challenge_invites")
      .column("challenge_id")
      .execute();

    await db.schema
      .createIndex("idx_invites_user")
      .on("challenge_invites")
      .column("user_id")
      .execute();

    await db.schema
      .createTable("chat_channel_counters")
      .addColumn("channel", "text", (col) => col.primaryKey())
      .addColumn("next_index", "integer", (col) => col.notNull().defaultTo(0))
      .execute();

    await db.schema
      .createTable("chat_messages")
      .addColumn("channel", "text", (col) => col.notNull())
      .addColumn("message_index", "integer", (col) => col.notNull())
      .addColumn("from_id", "text", (col) => col.notNull())
      .addColumn("to_id", "text")
      .addColumn("content", "text", (col) => col.notNull().defaultTo(""))
      .addColumn("timestamp", "integer", (col) => col.notNull())
      .addColumn("type", "text")
      .addColumn("redacted", "integer", (col) => col.notNull().defaultTo(0))
      .addPrimaryKeyConstraint("pk_chat_messages", ["channel", "message_index"])
      .execute();

    await db.schema
      .createTable("users")
      .addColumn("user_id", "text", (col) => col.primaryKey())
      .addColumn("username", "text")
      .addColumn("model", "text")
      .execute();

    await db.schema
      .createTable("scoring_metrics")
      .addColumn("scope", "text", (col) => col.notNull())
      .addColumn("challenge_type", "text", (col) => col.notNull())
      .addColumn("strategy_name", "text", (col) => col.notNull())
      .addColumn("player_id", "text", (col) => col.notNull())
      .addColumn("metric_key", "text", (col) => col.notNull())
      .addColumn("metric_value", "real", (col) => col.notNull())
      .addPrimaryKeyConstraint("pk_scoring_metrics", [
        "scope",
        "challenge_type",
        "strategy_name",
        "player_id",
        "metric_key",
      ])
      .execute();

    await db.schema
      .createIndex("idx_scoring_metrics_lookup")
      .on("scoring_metrics")
      .columns(["scope", "challenge_type", "strategy_name"])
      .execute();

    await db.schema
      .createIndex("idx_scoring_metrics_player")
      .on("scoring_metrics")
      .column("player_id")
      .execute();

    await db.schema
      .createTable("scoring_strategy_state")
      .addColumn("scope", "text", (col) => col.notNull())
      .addColumn("challenge_type", "text", (col) => col.notNull())
      .addColumn("strategy_name", "text", (col) => col.notNull())
      .addColumn("player_id", "text", (col) => col.notNull())
      .addColumn("state", "text", (col) => col.notNull())
      .addPrimaryKeyConstraint("pk_scoring_strategy_state", [
        "scope",
        "challenge_type",
        "strategy_name",
        "player_id",
      ])
      .execute();
  },
};

export class StaticMigrationProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return {
      "001_initial": migration001,
    };
  }
}
