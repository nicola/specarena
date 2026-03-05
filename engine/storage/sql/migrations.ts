import type { Kysely, Migration, MigrationProvider } from "kysely";

const migration001: Migration = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable("challenges")
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("challenge_type", "text", (col) => col.notNull())
      .addColumn("created_at", "integer", (col) => col.notNull())
      .addColumn("game_started", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("game_ended", "integer", (col) => col.notNull().defaultTo(0))
      .addColumn("completed_at", "integer")
      .addColumn("game_state", "text")
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
      .createTable("challenge_scores")
      .addColumn("challenge_id", "text", (col) =>
        col.notNull().references("challenges.id").onDelete("cascade")
      )
      .addColumn("player_index", "integer", (col) => col.notNull())
      .addColumn("security", "real", (col) => col.notNull())
      .addColumn("utility", "real", (col) => col.notNull())
      .addPrimaryKeyConstraint("pk_challenge_scores", [
        "challenge_id",
        "player_index",
      ])
      .execute();

    await db.schema
      .createTable("challenge_attributions")
      .addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
      .addColumn("challenge_id", "text", (col) =>
        col.notNull().references("challenges.id").onDelete("cascade")
      )
      .addColumn("from_idx", "integer", (col) => col.notNull())
      .addColumn("to_idx", "integer", (col) => col.notNull())
      .addColumn("type", "text", (col) => col.notNull())
      .execute();

    await db.schema
      .createIndex("idx_attributions_challenge")
      .on("challenge_attributions")
      .column("challenge_id")
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
      .addPrimaryKeyConstraint("pk_chat_messages", ["channel", "message_index"])
      .execute();

    await db.schema
      .createTable("users")
      .addColumn("user_id", "text", (col) => col.primaryKey())
      .addColumn("username", "text")
      .addColumn("model", "text")
      .execute();

    await db.schema
      .createTable("score_metrics")
      .addColumn("challenge_type", "text", (col) => col.notNull())
      .addColumn("strategy_name", "text", (col) => col.notNull())
      .addColumn("player_id", "text", (col) => col.notNull())
      .addColumn("metric_key", "text", (col) => col.notNull())
      .addColumn("metric_value", "real", (col) => col.notNull())
      .addPrimaryKeyConstraint("pk_score_metrics", [
        "challenge_type",
        "strategy_name",
        "player_id",
        "metric_key",
      ])
      .execute();

    await db.schema
      .createIndex("idx_score_metrics_type")
      .on("score_metrics")
      .columns(["challenge_type", "strategy_name"])
      .execute();

    await db.schema
      .createIndex("idx_score_metrics_player")
      .on("score_metrics")
      .column("player_id")
      .execute();

    await db.schema
      .createTable("strategy_state")
      .addColumn("challenge_type", "text", (col) => col.notNull())
      .addColumn("strategy_name", "text", (col) => col.notNull())
      .addColumn("player_id", "text", (col) => col.notNull())
      .addColumn("state", "text", (col) => col.notNull())
      .addPrimaryKeyConstraint("pk_strategy_state", [
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
