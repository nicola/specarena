import { type Kysely, type Migration, Migrator, sql } from "kysely";

// ── Migration 001: Initial schema ────────────────────────────────────

const migration001: Migration = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .createTable("users")
      .ifNotExists()
      .addColumn("user_id", "text", (col) => col.primaryKey())
      .addColumn("username", "text")
      .addColumn("model", "text")
      .execute();

    await db.schema
      .createTable("challenges")
      .ifNotExists()
      .addColumn("id", "text", (col) => col.primaryKey())
      .addColumn("name", "text", (col) => col.notNull())
      .addColumn("challenge_type", "text", (col) => col.notNull())
      .addColumn("created_at", "timestamptz", (col) => col.notNull())
      .addColumn("game_started", "boolean", (col) => col.notNull().defaultTo(false))
      .addColumn("game_ended", "boolean", (col) => col.notNull().defaultTo(false))
      .addColumn("completed_at", "timestamptz")
      .addColumn("game_state", "jsonb", (col) => col.notNull().defaultTo("{}"))
      .execute();

    await db.schema
      .createTable("challenge_invites")
      .ifNotExists()
      .addColumn("challenge_id", "text", (col) =>
        col.notNull().references("challenges.id").onDelete("cascade"),
      )
      .addColumn("invite", "text", (col) => col.notNull())
      .addColumn("user_id", "text")
      .addColumn("player_index", "integer")
      .addPrimaryKeyConstraint("challenge_invites_pk", ["challenge_id", "invite"])
      .execute();

    await db.schema
      .createIndex("challenge_invites_invite_unique")
      .ifNotExists()
      .on("challenge_invites")
      .column("invite")
      .unique()
      .execute();

    await db.schema
      .createIndex("challenge_invites_user_id_idx")
      .ifNotExists()
      .on("challenge_invites")
      .column("user_id")
      .execute();

    await db.schema
      .createTable("chat_messages")
      .ifNotExists()
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
      .createIndex("chat_messages_channel_idx")
      .ifNotExists()
      .on("chat_messages")
      .column("channel")
      .execute();

    await db.schema
      .createTable("game_scores")
      .ifNotExists()
      .addColumn("challenge_id", "text", (col) =>
        col.notNull().references("challenges.id").onDelete("cascade"),
      )
      .addColumn("player_id", "text", (col) => col.notNull())
      .addColumn("security", "real", (col) => col.notNull())
      .addColumn("utility", "real", (col) => col.notNull())
      .addPrimaryKeyConstraint("game_scores_pk", ["challenge_id", "player_id"])
      .execute();

    await db.schema
      .createTable("scoring_attributions")
      .ifNotExists()
      .addColumn("id", "serial", (col) => col.primaryKey())
      .addColumn("challenge_id", "text", (col) =>
        col.notNull().references("challenges.id").onDelete("cascade"),
      )
      .addColumn("from_player_index", "integer", (col) => col.notNull())
      .addColumn("to_player_index", "integer", (col) => col.notNull())
      .addColumn("type", "text", (col) => col.notNull())
      .execute();

    await db.schema
      .createTable("scoring_metrics")
      .ifNotExists()
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
      .createTable("scoring_strategy_state")
      .ifNotExists()
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
  },

  async down(db: Kysely<unknown>) {
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
  },
};

// ── Migration 002: Add benchmark columns ─────────────────────────────

const migration002: Migration = {
  async up(db: Kysely<unknown>) {
    await db.schema
      .alterTable("users")
      .addColumn("is_benchmark", "boolean", (col) => col.notNull().defaultTo(false))
      .execute();

    await db.schema
      .alterTable("challenges")
      .addColumn("game_category", "text", (col) => col.notNull().defaultTo("train"))
      .execute();
  },

  async down(db: Kysely<unknown>) {
    await db.schema.alterTable("users").dropColumn("is_benchmark").execute();
    await db.schema.alterTable("challenges").dropColumn("game_category").execute();
  },
};

// ── Migration 003: Replace game_started/game_ended with status ───────

const migration003: Migration = {
  up: async (db) => {
    await sql`ALTER TABLE challenges ADD COLUMN status TEXT NOT NULL DEFAULT 'open'`.execute(db);
    await sql`UPDATE challenges SET status = 'ended' WHERE game_ended = TRUE`.execute(db);
    await sql`UPDATE challenges SET status = 'active' WHERE game_ended = FALSE AND game_started = TRUE`.execute(db);
    await sql`ALTER TABLE challenges DROP COLUMN game_started`.execute(db);
    await sql`ALTER TABLE challenges DROP COLUMN game_ended`.execute(db);
    await sql`CREATE INDEX challenges_status_idx ON challenges (status)`.execute(db);
  },
  down: async (db) => {
    await sql`DROP INDEX challenges_status_idx`.execute(db);
    await sql`ALTER TABLE challenges ADD COLUMN game_started BOOLEAN NOT NULL DEFAULT FALSE`.execute(db);
    await sql`ALTER TABLE challenges ADD COLUMN game_ended BOOLEAN NOT NULL DEFAULT FALSE`.execute(db);
    await sql`UPDATE challenges SET game_started = TRUE WHERE status IN ('active', 'ended')`.execute(db);
    await sql`UPDATE challenges SET game_ended = TRUE WHERE status = 'ended'`.execute(db);
    await sql`ALTER TABLE challenges DROP COLUMN status`.execute(db);
  },
};

// ── Migration 004: Flexible score dimensions ───────────────────────────

const migration004: Migration = {
  async up(db: Kysely<unknown>) {
    // Create new row-per-dimension table
    await db.schema
      .createTable("game_score_dimensions")
      .addColumn("challenge_id", "text", (col) =>
        col.notNull().references("challenges.id").onDelete("cascade"),
      )
      .addColumn("player_id", "text", (col) => col.notNull())
      .addColumn("dimension", "text", (col) => col.notNull())
      .addColumn("value", "real", (col) => col.notNull())
      .addPrimaryKeyConstraint("game_score_dimensions_pk", [
        "challenge_id",
        "player_id",
        "dimension",
      ])
      .execute();

    // Migrate existing data: split security/utility into separate rows
    await sql`
      INSERT INTO game_score_dimensions (challenge_id, player_id, dimension, value)
      SELECT challenge_id, player_id, 'utility', utility FROM game_scores
      UNION ALL
      SELECT challenge_id, player_id, 'security', security FROM game_scores
    `.execute(db);

    // Drop old table and rename new one
    await db.schema.dropTable("game_scores").execute();
    await sql`ALTER TABLE game_score_dimensions RENAME TO game_scores`.execute(db);
  },

  async down(db: Kysely<unknown>) {
    // Recreate old fixed-column table
    await db.schema
      .createTable("game_scores_fixed")
      .addColumn("challenge_id", "text", (col) =>
        col.notNull().references("challenges.id").onDelete("cascade"),
      )
      .addColumn("player_id", "text", (col) => col.notNull())
      .addColumn("security", "real", (col) => col.notNull())
      .addColumn("utility", "real", (col) => col.notNull())
      .addPrimaryKeyConstraint("game_scores_fixed_pk", ["challenge_id", "player_id"])
      .execute();

    // Pivot rows back into columns
    await sql`
      INSERT INTO game_scores_fixed (challenge_id, player_id, security, utility)
      SELECT
        challenge_id,
        player_id,
        COALESCE(MAX(CASE WHEN dimension = 'security' THEN value END), 0) AS security,
        COALESCE(MAX(CASE WHEN dimension = 'utility' THEN value END), 0) AS utility
      FROM game_scores
      GROUP BY challenge_id, player_id
    `.execute(db);

    await db.schema.dropTable("game_scores").execute();
    await sql`ALTER TABLE game_scores_fixed RENAME TO game_scores`.execute(db);
  },
};

// ── Migration registry ───────────────────────────────────────────────

const migrations: Record<string, Migration> = {
  "001_initial_schema": migration001,
  "002_benchmark_columns": migration002,
  "003_challenge_status": migration003,
  "004_flexible_score_dimensions": migration004,
};

/**
 * Run all pending migrations.
 */
export async function up(db: Kysely<unknown>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: { getMigrations: async () => migrations },
  });

  const { error, results } = await migrator.migrateToLatest();

  for (const result of results ?? []) {
    if (result.status === "Success") {
      console.log(`  ✔ ${result.migrationName}`);
    } else if (result.status === "Error") {
      console.error(`  ✘ ${result.migrationName}`);
    }
  }

  if (error) throw error;
}

/**
 * Rollback all migrations.
 */
export async function down(db: Kysely<unknown>): Promise<void> {
  const migrator = new Migrator({
    db,
    provider: { getMigrations: async () => migrations },
  });

  // Migrate down one at a time until none are left
  let hasMore = true;
  while (hasMore) {
    const { error, results } = await migrator.migrateDown();
    hasMore = (results ?? []).some((r) => r.status === "Success");

    for (const result of results ?? []) {
      if (result.status === "Success") {
        console.log(`  ↩ ${result.migrationName}`);
      } else if (result.status === "Error") {
        console.error(`  ✘ ${result.migrationName}`);
      }
    }

    if (error) throw error;
  }
}
