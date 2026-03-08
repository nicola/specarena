import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .createTable("users").ifNotExists()
    .addColumn("user_id", "text", (col) => col.primaryKey())
    .addColumn("username", "text")
    .addColumn("model", "text")
    .addColumn("is_benchmark", "boolean", (col) => col.notNull().defaultTo(false))
    .execute();

  await db.schema
    .createTable("challenges").ifNotExists()
    .addColumn("id", "text", (col) => col.primaryKey())
    .addColumn("name", "text", (col) => col.notNull())
    .addColumn("challenge_type", "text", (col) => col.notNull())
    .addColumn("created_at", "timestamptz", (col) => col.notNull())
    .addColumn("game_started", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("game_ended", "boolean", (col) => col.notNull().defaultTo(false))
    .addColumn("completed_at", "timestamptz")
    .addColumn("game_state", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addColumn("game_category", "text")
    .execute();

  await db.schema
    .createTable("challenge_invites").ifNotExists()
    .addColumn("challenge_id", "text", (col) =>
      col.notNull().references("challenges.id").onDelete("cascade"),
    )
    .addColumn("invite", "text", (col) => col.notNull())
    .addColumn("user_id", "text")
    .addColumn("player_index", "integer")
    .addPrimaryKeyConstraint("challenge_invites_pk", ["challenge_id", "invite"])
    .execute();

  await db.schema
    .createIndex("challenge_invites_invite_unique").ifNotExists()
    .on("challenge_invites")
    .column("invite")
    .unique()
    .execute();

  await db.schema
    .createIndex("challenge_invites_user_id_idx").ifNotExists()
    .on("challenge_invites")
    .column("user_id")
    .execute();

  await db.schema
    .createTable("chat_messages").ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("channel", "text", (col) => col.notNull())
    .addColumn("index", "integer", (col) => col.notNull())
    .addColumn("from", "text", (col) => col.notNull())
    .addColumn("to", "text")
    .addColumn("content", "text", (col) => col.notNull())
    .addColumn("timestamp", "timestamptz", (col) => col.notNull())
    .addColumn("type", "text")
    .addUniqueConstraint("chat_messages_channel_index_unique", ["channel", "index"])
    .execute();

  await db.schema
    .createIndex("chat_messages_channel_idx").ifNotExists()
    .on("chat_messages")
    .column("channel")
    .execute();

  await db.schema
    .createTable("game_scores").ifNotExists()
    .addColumn("challenge_id", "text", (col) =>
      col.notNull().references("challenges.id").onDelete("cascade"),
    )
    .addColumn("player_id", "text", (col) => col.notNull())
    .addColumn("security", "real", (col) => col.notNull())
    .addColumn("utility", "real", (col) => col.notNull())
    .addPrimaryKeyConstraint("game_scores_pk", ["challenge_id", "player_id"])
    .execute();

  await db.schema
    .createTable("scoring_attributions").ifNotExists()
    .addColumn("id", "serial", (col) => col.primaryKey())
    .addColumn("challenge_id", "text", (col) =>
      col.notNull().references("challenges.id").onDelete("cascade"),
    )
    .addColumn("from_player_index", "integer", (col) => col.notNull())
    .addColumn("to_player_index", "integer", (col) => col.notNull())
    .addColumn("type", "text", (col) => col.notNull())
    .execute();

  await db.schema
    .createTable("scoring_metrics").ifNotExists()
    .addColumn("challenge_type", "text", (col) => col.notNull())
    .addColumn("strategy_name", "text", (col) => col.notNull())
    .addColumn("player_id", "text", (col) => col.notNull())
    .addColumn("metric_key", "text", (col) => col.notNull())
    .addColumn("value", "real", (col) => col.notNull().defaultTo(0))
    .addPrimaryKeyConstraint("scoring_metrics_pk", [
      "challenge_type",
      "strategy_name",
      "player_id",
      "metric_key",
    ])
    .execute();

  await db.schema
    .createTable("scoring_strategy_state").ifNotExists()
    .addColumn("challenge_type", "text", (col) => col.notNull())
    .addColumn("strategy_name", "text", (col) => col.notNull())
    .addColumn("player_id", "text", (col) => col.notNull())
    .addColumn("state", "jsonb", (col) => col.notNull().defaultTo("{}"))
    .addPrimaryKeyConstraint("scoring_strategy_state_pk", [
      "challenge_type",
      "strategy_name",
      "player_id",
    ])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  const tables = [
    "scoring_strategy_state",
    "scoring_metrics",
    "scoring_attributions",
    "game_scores",
    "chat_messages",
    "challenge_invites",
    "challenges",
    "users",
  ] as const;

  for (const table of tables) {
    await db.schema.dropTable(table).ifExists().execute();
  }
}
