import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import SQLite from "better-sqlite3";
import { Kysely, SqliteDialect } from "kysely";
import {
  createDatabase,
  migrateToLatest,
  SqlChatStorageAdapter,
  SqlUserStorageAdapter,
  SqlScoringStorageAdapter,
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
