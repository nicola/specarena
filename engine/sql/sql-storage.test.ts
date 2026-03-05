import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import SQLite from "better-sqlite3";
import { Kysely, Migrator, SqliteDialect } from "kysely";
import {
  createDatabase,
  migrateToLatest,
  SqlChatStorageAdapter,
  SqlUserStorageAdapter,
  SqlScoringStorageAdapter,
  ArenaMigrationProvider,
} from "./index";
import type { Database } from "./db";
import type { ChatStorageAdapter } from "../storage/InMemoryChatStorageAdapter";
import { InMemoryChatStorageAdapter } from "../storage/InMemoryChatStorageAdapter";
import type { UserStorageAdapter } from "../users";
import { InMemoryUserStorageAdapter } from "../users";
import type { ScoringStorageAdapter } from "@arena/scoring";
import { InMemoryScoringStore } from "@arena/scoring";

// ─── Engine definitions ─────────────────────────────────────

interface Engine {
  name: string;
  setup(): Promise<void>;
  teardown(): Promise<void>;
  chat(): ChatStorageAdapter;
  users(): UserStorageAdapter;
  scoring(): ScoringStorageAdapter;
}

function inMemoryEngine(): Engine {
  let chat: InMemoryChatStorageAdapter;
  let users: InMemoryUserStorageAdapter;
  let scoring: InMemoryScoringStore;
  return {
    name: "InMemory",
    async setup() {
      chat = new InMemoryChatStorageAdapter();
      users = new InMemoryUserStorageAdapter();
      scoring = new InMemoryScoringStore();
    },
    async teardown() {},
    chat: () => chat,
    users: () => users,
    scoring: () => scoring,
  };
}

function sqlEngine(): Engine {
  let db: Kysely<Database>;
  let chat: SqlChatStorageAdapter;
  let users: SqlUserStorageAdapter;
  let scoring: SqlScoringStorageAdapter;
  return {
    name: "SQL",
    async setup() {
      db = createDatabase(
        new SqliteDialect({ database: new SQLite(":memory:") })
      );
      await migrateToLatest(db);
      chat = new SqlChatStorageAdapter(db);
      users = new SqlUserStorageAdapter(db);
      scoring = new SqlScoringStorageAdapter(db);
    },
    async teardown() {
      await db?.destroy();
    },
    chat: () => chat,
    users: () => users,
    scoring: () => scoring,
  };
}

// ─── Shared test suites ─────────────────────────────────────

function chatTests(engine: Engine) {
  describe("ChatStorageAdapter", () => {
    it("getNextIndex increments per channel", async () => {
      const chat = engine.chat();
      assert.equal(await chat.getNextIndex("ch1"), 1);
      assert.equal(await chat.getNextIndex("ch1"), 2);
      assert.equal(await chat.getNextIndex("ch1"), 3);
      assert.equal(await chat.getNextIndex("ch2"), 1);
    });

    it("appendMessage and getMessagesForChannel", async () => {
      const chat = engine.chat();
      await chat.appendMessage("ch1", {
        channel: "ch1",
        from: "alice",
        to: "bob",
        content: "hello",
        index: 1,
        timestamp: 1000,
        type: "text",
      });
      await chat.appendMessage("ch1", {
        channel: "ch1",
        from: "bob",
        content: "hi",
        index: 2,
        timestamp: 2000,
      });

      const msgs = await chat.getMessagesForChannel("ch1");
      assert.equal(msgs.length, 2);
      assert.equal(msgs[0].from, "alice");
      assert.equal(msgs[0].to, "bob");
      assert.equal(msgs[0].content, "hello");
      assert.equal(msgs[0].type, "text");
      assert.equal(msgs[1].from, "bob");
      assert.equal(msgs[1].content, "hi");
    });

    it("getMessagesForChannel returns empty for unknown channel", async () => {
      assert.deepEqual(await engine.chat().getMessagesForChannel("x"), []);
    });

    it("deleteChannel removes messages and counter", async () => {
      const chat = engine.chat();
      await chat.getNextIndex("ch1");
      await chat.appendMessage("ch1", {
        channel: "ch1",
        from: "alice",
        content: "hello",
        index: 1,
        timestamp: 1000,
      });

      await chat.deleteChannel("ch1");

      assert.deepEqual(await chat.getMessagesForChannel("ch1"), []);
      assert.equal(await chat.getNextIndex("ch1"), 1);
    });

    it("deleteChannel does not affect other channels", async () => {
      const chat = engine.chat();
      await chat.appendMessage("ch1", {
        channel: "ch1",
        from: "alice",
        content: "msg1",
        index: 1,
        timestamp: 1000,
      });
      await chat.appendMessage("ch2", {
        channel: "ch2",
        from: "bob",
        content: "msg2",
        index: 1,
        timestamp: 2000,
      });
      await chat.getNextIndex("ch1");
      await chat.getNextIndex("ch2");

      await chat.deleteChannel("ch1");

      assert.deepEqual(await chat.getMessagesForChannel("ch1"), []);
      const ch2Msgs = await chat.getMessagesForChannel("ch2");
      assert.equal(ch2Msgs.length, 1);
      assert.equal(ch2Msgs[0].from, "bob");
      // ch2 counter unaffected — was 1, next is 2
      assert.equal(await chat.getNextIndex("ch2"), 2);
    });

    it("deleteChannel on nonexistent channel is a no-op", async () => {
      await engine.chat().deleteChannel("nonexistent");
    });

    it("clearRuntimeState clears everything", async () => {
      const chat = engine.chat();
      await chat.appendMessage("ch1", {
        channel: "ch1",
        from: "alice",
        content: "hello",
        index: 1,
        timestamp: 1000,
      });
      await chat.getNextIndex("ch1");

      await chat.clearRuntimeState();

      assert.deepEqual(await chat.getMessagesForChannel("ch1"), []);
      assert.equal(await chat.getNextIndex("ch1"), 1);
    });

    it("handles redacted messages", async () => {
      const chat = engine.chat();
      await chat.appendMessage("ch1", {
        channel: "ch1",
        from: "alice",
        content: "[redacted]",
        index: 1,
        timestamp: 1000,
        redacted: true,
      });

      const msgs = await chat.getMessagesForChannel("ch1");
      assert.equal(msgs[0].redacted, true);
    });
  });
}

function userTests(engine: Engine) {
  describe("UserStorageAdapter", () => {
    it("setUser creates a new user", async () => {
      const user = await engine.users().setUser("u1", {
        username: "Alice",
        model: "gpt-4",
      });
      assert.deepEqual(user, {
        userId: "u1",
        username: "Alice",
        model: "gpt-4",
      });
    });

    it("getUser retrieves an existing user", async () => {
      const users = engine.users();
      await users.setUser("u1", { username: "Alice" });
      const user = await users.getUser("u1");
      assert.equal(user?.userId, "u1");
      assert.equal(user?.username, "Alice");
    });

    it("getUser returns undefined for nonexistent user", async () => {
      assert.equal(await engine.users().getUser("nonexistent"), undefined);
    });

    it("setUser updates existing user", async () => {
      const users = engine.users();
      await users.setUser("u1", { username: "Alice", model: "gpt-4" });
      const updated = await users.setUser("u1", { model: "claude-3" });
      assert.equal(updated.model, "claude-3");
      assert.equal(updated.username, "Alice");

      const fetched = await users.getUser("u1");
      assert.equal(fetched?.model, "claude-3");
      assert.equal(fetched?.username, "Alice");
    });

    it("getUsers batch retrieves", async () => {
      const users = engine.users();
      await users.setUser("u1", { username: "Alice" });
      await users.setUser("u2", { username: "Bob" });
      await users.setUser("u3", { username: "Charlie" });

      const result = await users.getUsers(["u1", "u3", "u999"]);
      assert.equal(Object.keys(result).length, 2);
      assert.equal(result.u1.username, "Alice");
      assert.equal(result.u3.username, "Charlie");
    });

    it("getUsers returns empty for empty input", async () => {
      assert.deepEqual(await engine.users().getUsers([]), {});
    });

    it("listUsers returns all users", async () => {
      const users = engine.users();
      await users.setUser("u1", { username: "Alice" });
      await users.setUser("u2", { username: "Bob" });

      const list = await users.listUsers();
      assert.equal(list.length, 2);
    });

    it("setUser with empty updates returns existing user unchanged", async () => {
      const users = engine.users();
      await users.setUser("u1", { username: "Alice", model: "gpt-4" });
      const result = await users.setUser("u1", {});
      assert.equal(result.userId, "u1");
      assert.equal(result.username, "Alice");
      assert.equal(result.model, "gpt-4");
    });

    it("setUser creates user with no optional fields", async () => {
      const users = engine.users();
      const user = await users.setUser("u1", {});
      assert.equal(user.userId, "u1");

      const fetched = await users.getUser("u1");
      assert.equal(fetched?.userId, "u1");
      assert.equal(fetched?.username, undefined);
      assert.equal(fetched?.model, undefined);
    });

    it("clearRuntimeState clears all users", async () => {
      const users = engine.users();
      await users.setUser("u1", { username: "Alice" });
      await users.clearRuntimeState();
      assert.deepEqual(await users.listUsers(), []);
    });
  });
}

function scoringTests(engine: Engine) {
  describe("ScoringStorageAdapter", () => {
    it("setScoreEntry and getScoreEntry", async () => {
      const scoring = engine.scoring();
      await scoring.setScoreEntry("challenge1", "elo", {
        playerId: "p1",
        gamesPlayed: 5,
        metrics: { rating: 1200 },
      });

      const entry = await scoring.getScoreEntry("challenge1", "elo", "p1");
      assert.deepEqual(entry, {
        playerId: "p1",
        gamesPlayed: 5,
        metrics: { rating: 1200 },
      });
    });

    it("getScoreEntry returns undefined for nonexistent", async () => {
      assert.equal(
        await engine.scoring().getScoreEntry("x", "y", "z"),
        undefined
      );
    });

    it("setScoreEntry upserts", async () => {
      const scoring = engine.scoring();
      await scoring.setScoreEntry("c1", "elo", {
        playerId: "p1",
        gamesPlayed: 1,
        metrics: { rating: 1000 },
      });
      await scoring.setScoreEntry("c1", "elo", {
        playerId: "p1",
        gamesPlayed: 2,
        metrics: { rating: 1100 },
      });

      const entry = await scoring.getScoreEntry("c1", "elo", "p1");
      assert.equal(entry?.gamesPlayed, 2);
      assert.equal(entry?.metrics.rating, 1100);
    });

    it("getScores groups by strategy", async () => {
      const scoring = engine.scoring();
      await scoring.setScoreEntry("c1", "elo", {
        playerId: "p1",
        gamesPlayed: 1,
        metrics: { rating: 1000 },
      });
      await scoring.setScoreEntry("c1", "elo", {
        playerId: "p2",
        gamesPlayed: 2,
        metrics: { rating: 1100 },
      });
      await scoring.setScoreEntry("c1", "winrate", {
        playerId: "p1",
        gamesPlayed: 1,
        metrics: { wins: 1 },
      });

      const scores = await scoring.getScores("c1");
      assert.equal(scores.elo.length, 2);
      assert.equal(scores.winrate.length, 1);
    });

    it("getScores returns empty for unknown challengeType", async () => {
      assert.deepEqual(await engine.scoring().getScores("unknown"), {});
    });

    it("getScores isolates by challengeType", async () => {
      const scoring = engine.scoring();
      await scoring.setScoreEntry("c1", "elo", {
        playerId: "p1",
        gamesPlayed: 1,
        metrics: { r: 1000 },
      });
      await scoring.setScoreEntry("c2", "elo", {
        playerId: "p2",
        gamesPlayed: 2,
        metrics: { r: 2000 },
      });

      const c1 = await scoring.getScores("c1");
      assert.equal(c1.elo.length, 1);
      assert.equal(c1.elo[0].playerId, "p1");

      const c2 = await scoring.getScores("c2");
      assert.equal(c2.elo.length, 1);
      assert.equal(c2.elo[0].playerId, "p2");
    });

    it("global score entries", async () => {
      const scoring = engine.scoring();
      await scoring.setGlobalScoreEntry({
        playerId: "p1",
        gamesPlayed: 10,
        metrics: { total: 100 },
      });

      const entry = await scoring.getGlobalScoreEntry("p1");
      assert.deepEqual(entry, {
        playerId: "p1",
        gamesPlayed: 10,
        metrics: { total: 100 },
      });

      const all = await scoring.getGlobalScores();
      assert.equal(all.length, 1);
    });

    it("strategy state CRUD", async () => {
      const scoring = engine.scoring();
      assert.equal(
        await scoring.getStrategyState("c1", "elo", "p1"),
        undefined
      );

      await scoring.setStrategyState("c1", "elo", "p1", {
        history: [1, 2],
      });
      const state = await scoring.getStrategyState<{ history: number[] }>(
        "c1",
        "elo",
        "p1"
      );
      assert.deepEqual(state, { history: [1, 2] });

      await scoring.setStrategyState("c1", "elo", "p1", { history: [3] });
      const updated = await scoring.getStrategyState<{ history: number[] }>(
        "c1",
        "elo",
        "p1"
      );
      assert.deepEqual(updated, { history: [3] });
    });

    it("global strategy state CRUD", async () => {
      const scoring = engine.scoring();
      assert.equal(await scoring.getGlobalStrategyState("p1"), undefined);

      await scoring.setGlobalStrategyState("p1", { streak: 5 });
      const state = await scoring.getGlobalStrategyState<{ streak: number }>(
        "p1"
      );
      assert.deepEqual(state, { streak: 5 });
    });

    it("transaction wraps operations atomically", async () => {
      const scoring = engine.scoring();
      await scoring.transaction(async (store) => {
        await store.setScoreEntry("c1", "elo", {
          playerId: "p1",
          gamesPlayed: 1,
          metrics: { r: 1000 },
        });
        await store.setGlobalScoreEntry({
          playerId: "p1",
          gamesPlayed: 1,
          metrics: { r: 1000 },
        });
      });

      assert.ok(await scoring.getScoreEntry("c1", "elo", "p1"));
      assert.ok(await scoring.getGlobalScoreEntry("p1"));
    });

    it("clear removes all scoring data", async () => {
      const scoring = engine.scoring();
      await scoring.setScoreEntry("c1", "elo", {
        playerId: "p1",
        gamesPlayed: 1,
        metrics: {},
      });
      await scoring.setGlobalScoreEntry({
        playerId: "p1",
        gamesPlayed: 1,
        metrics: {},
      });
      await scoring.setStrategyState("c1", "elo", "p1", { x: 1 });
      await scoring.setGlobalStrategyState("p1", { y: 2 });

      await scoring.clear();

      assert.deepEqual(await scoring.getScores("c1"), {});
      assert.deepEqual(await scoring.getGlobalScores(), []);
      assert.equal(
        await scoring.getStrategyState("c1", "elo", "p1"),
        undefined
      );
      assert.equal(await scoring.getGlobalStrategyState("p1"), undefined);
    });

    it("waitForIdle resolves", async () => {
      await engine.scoring().waitForIdle();
    });
  });
}

// ─── Run suites for each engine ─────────────────────────────

for (const makeEngine of [inMemoryEngine, sqlEngine]) {
  const engine = makeEngine();

  describe(`${engine.name} Storage`, () => {
    beforeEach(() => engine.setup());
    afterEach(() => engine.teardown());

    chatTests(engine);
    userTests(engine);
    scoringTests(engine);
  });
}

// ─── SQL-specific tests ─────────────────────────────────────

describe("SQL Storage (SQL-specific)", () => {
  const engine = sqlEngine();

  beforeEach(() => engine.setup());
  afterEach(() => engine.teardown());

  it("migration down drops all tables and re-up restores them", async () => {
    const db = createDatabase(
      new SqliteDialect({ database: new SQLite(":memory:") })
    );
    await migrateToLatest(db);

    // Insert some data
    const chat = new SqlChatStorageAdapter(db);
    await chat.appendMessage("ch1", {
      channel: "ch1",
      from: "alice",
      content: "hello",
      index: 1,
      timestamp: 1000,
    });

    // Migrate down
    const migrator = new Migrator({
      db,
      provider: new ArenaMigrationProvider(),
    });
    await migrator.migrateDown();

    // Tables should be gone — query should throw
    await assert.rejects(
      () => db.selectFrom("chat_messages").selectAll().execute(),
      /no such table/
    );

    // Re-migrate up
    await migrateToLatest(db);

    // Should work again, but empty
    const msgs = await chat.getMessagesForChannel("ch1");
    assert.deepEqual(msgs, []);

    await db.destroy();
  });

  it("transaction rolls back all writes on error", async () => {
    const scoring = engine.scoring();
    await assert.rejects(() =>
      scoring.transaction(async (store) => {
        await store.setScoreEntry("c1", "elo", {
          playerId: "p1",
          gamesPlayed: 1,
          metrics: { r: 1000 },
        });
        throw new Error("deliberate failure");
      })
    );

    // Write must not have persisted
    assert.equal(await scoring.getScoreEntry("c1", "elo", "p1"), undefined);
  });
});
