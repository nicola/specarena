import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  bigint,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  userId: text("user_id").primaryKey(),
  username: text("username"),
  model: text("model"),
});

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: serial("id").primaryKey(),
    channel: text("channel").notNull(),
    index: integer("index").notNull(),
    from: text("from").notNull(),
    to: text("to"),
    content: text("content").notNull(),
    timestamp: bigint("timestamp", { mode: "number" }),
    type: text("type"),
    redacted: boolean("redacted").default(false),
  },
  (t) => [
    index("chat_messages_channel_idx").on(t.channel),
    uniqueIndex("chat_messages_channel_index_idx").on(t.channel, t.index),
  ],
);

export const chatChannelCounters = pgTable("chat_channel_counters", {
  channel: text("channel").primaryKey(),
  nextIndex: integer("next_index").notNull().default(0),
});

export const scoringEntries = pgTable(
  "scoring_entries",
  {
    challengeType: text("challenge_type").notNull(),
    strategyName: text("strategy_name").notNull(),
    playerId: text("player_id").notNull(),
    gamesPlayed: integer("games_played").notNull().default(0),
    metrics: jsonb("metrics").notNull().$type<Record<string, number>>(),
    state: jsonb("state"),
  },
  (t) => [
    uniqueIndex("scoring_entries_unique_idx").on(
      t.challengeType,
      t.strategyName,
      t.playerId,
    ),
    index("scoring_entries_challenge_type_idx").on(t.challengeType),
  ],
);
