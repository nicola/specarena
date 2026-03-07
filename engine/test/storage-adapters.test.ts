import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { InMemoryArenaStorageAdapter } from "../storage/InMemoryArenaStorageAdapter";
import { InMemoryChatStorageAdapter } from "../storage/InMemoryChatStorageAdapter";
import { InMemoryUserStorageAdapter } from "../users/index";
import { createTestDb, resetTestDb, type TestStorage } from "./helpers/test-db";
import type { ArenaStorageAdapter, ChatStorageAdapter, UserStorageAdapter } from "../storage/types";
import type { Challenge } from "../types";

function mockChallenge(id: string, invites: string[], overrides?: Partial<Challenge>): Challenge {
  return {
    id,
    name: "test",
    challengeType: "test",
    createdAt: Date.now(),
    invites,
    gameState: {},
    state: {
      gameStarted: false,
      gameEnded: false,
      scores: [],
      players: [],
      playerIdentities: {},
    },
    ...overrides,
  };
}

// ── Arena storage tests ─────────────────────────────────────────────

function arenaTests(name: string, getAdapter: () => ArenaStorageAdapter) {
  describe(`ArenaStorageAdapter (${name})`, () => {
    it("stores and retrieves a challenge", async () => {
      const adapter = getAdapter();
      const challenge = mockChallenge("c1", ["inv_a", "inv_b"]);
      await adapter.setChallenge(challenge);

      const result = await adapter.getChallenge("c1");
      assert.equal(result?.id, "c1");
      assert.equal(result?.challengeType, "test");
    });

    it("returns undefined for unknown challenge", async () => {
      const adapter = getAdapter();
      const result = await adapter.getChallenge("nonexistent");
      assert.equal(result, undefined);
    });

    it("resolves challenge by invite", async () => {
      const adapter = getAdapter();
      await adapter.setChallenge(mockChallenge("c1", ["inv_a", "inv_b"]));

      const result = await adapter.getChallengeFromInvite("inv_b");
      assert.equal(result?.id, "c1");
    });

    it("returns undefined for unknown invite", async () => {
      const adapter = getAdapter();
      const result = await adapter.getChallengeFromInvite("inv_nonexistent");
      assert.equal(result, undefined);
    });

    it("updates invite index when challenge is overwritten", async () => {
      const adapter = getAdapter();
      await adapter.setChallenge(mockChallenge("c1", ["inv_old"]));
      await adapter.setChallenge(mockChallenge("c1", ["inv_new"]));

      assert.equal(await adapter.getChallengeFromInvite("inv_old"), undefined);
      assert.equal((await adapter.getChallengeFromInvite("inv_new"))?.id, "c1");
    });

    it("deletes a challenge", async () => {
      const adapter = getAdapter();
      await adapter.setChallenge(mockChallenge("c1", ["inv_a"]));
      await adapter.deleteChallenge("c1");

      assert.equal(await adapter.getChallenge("c1"), undefined);
      assert.equal(await adapter.getChallengeFromInvite("inv_a"), undefined);
    });

    it("lists all challenges", async () => {
      const adapter = getAdapter();
      await adapter.setChallenge(mockChallenge("c1", ["inv_a"]));
      await adapter.setChallenge(mockChallenge("c2", ["inv_b"]));

      const { items, total } = await adapter.listChallenges();
      assert.equal(items.length, 2);
      assert.equal(total, 2);
    });

    it("finds challenges by userId via playerIdentities", async () => {
      const adapter = getAdapter();
      const c = mockChallenge("c1", ["inv_a", "inv_b"]);
      c.state.playerIdentities = { inv_a: "user1" };
      c.state.players = ["inv_a"];
      await adapter.setChallenge(c);

      const { items: results } = await adapter.getChallengesByUserId("user1");
      assert.equal(results.length, 1);
      assert.equal(results[0].id, "c1");

      const { items: empty } = await adapter.getChallengesByUserId("user_unknown");
      assert.equal(empty.length, 0);
    });

    it("clears all data", async () => {
      const adapter = getAdapter();
      await adapter.setChallenge(mockChallenge("c1", ["inv_a"]));
      await adapter.clearRuntimeState();

      assert.equal(await adapter.getChallenge("c1"), undefined);
      const { items } = await adapter.listChallenges();
      assert.deepEqual(items, []);
    });

    it("preserves gameState through round-trip", async () => {
      const adapter = getAdapter();
      const c = mockChallenge("c1", ["inv_a"]);
      c.gameState = { items: [1, 2, 3], nested: { key: "value" } };
      await adapter.setChallenge(c);

      const result = await adapter.getChallenge("c1");
      assert.deepEqual(result?.gameState, { items: [1, 2, 3], nested: { key: "value" } });
    });

    it("preserves scores and attributions through round-trip", async () => {
      const adapter = getAdapter();
      const c = mockChallenge("c1", ["inv_a", "inv_b"]);
      c.state.players = ["inv_a", "inv_b"];
      c.state.scores = [{ security: 0.8, utility: 0.6 }, { security: 0.3, utility: 0.9 }];
      c.state.attributions = [{ from: 0, to: 1, type: "security_breach" }];
      c.state.gameEnded = true;
      c.state.completedAt = Date.now();
      await adapter.setChallenge(c);

      const result = await adapter.getChallenge("c1");
      assert.deepEqual(result?.state.scores, c.state.scores);
      assert.deepEqual(result?.state.attributions, c.state.attributions);
      assert.equal(result?.state.gameEnded, true);
      assert.ok(result?.state.completedAt);
    });
  });
}

// ── Chat storage tests ──────────────────────────────────────────────

function chatTests(name: string, getAdapter: () => ChatStorageAdapter) {
  describe(`ChatStorageAdapter (${name})`, () => {
    it("appends a message and assigns index atomically", async () => {
      const adapter = getAdapter();
      const msg = await adapter.appendMessage("ch1", {
        channel: "ch1",
        from: "alice",
        content: "hello",
        timestamp: Date.now(),
      });

      assert.equal(msg.index, 1);
      assert.equal(msg.from, "alice");
      assert.equal(msg.content, "hello");
    });

    it("increments index for subsequent messages", async () => {
      const adapter = getAdapter();
      const msg1 = await adapter.appendMessage("ch1", {
        channel: "ch1", from: "alice", content: "msg1", timestamp: Date.now(),
      });
      const msg2 = await adapter.appendMessage("ch1", {
        channel: "ch1", from: "bob", content: "msg2", timestamp: Date.now(),
      });

      assert.equal(msg1.index, 1);
      assert.equal(msg2.index, 2);
    });

    it("maintains separate counters per channel", async () => {
      const adapter = getAdapter();
      const m1 = await adapter.appendMessage("ch1", {
        channel: "ch1", from: "alice", content: "a", timestamp: Date.now(),
      });
      const m2 = await adapter.appendMessage("ch2", {
        channel: "ch2", from: "bob", content: "b", timestamp: Date.now(),
      });

      assert.equal(m1.index, 1);
      assert.equal(m2.index, 1);
    });

    it("retrieves messages for a channel in order", async () => {
      const adapter = getAdapter();
      await adapter.appendMessage("ch1", { channel: "ch1", from: "a", content: "first", timestamp: 1000 });
      await adapter.appendMessage("ch1", { channel: "ch1", from: "b", content: "second", timestamp: 2000 });

      const messages = await adapter.getMessagesForChannel("ch1");
      assert.equal(messages.length, 2);
      assert.equal(messages[0].content, "first");
      assert.equal(messages[1].content, "second");
      assert.equal(messages[0].index, 1);
      assert.equal(messages[1].index, 2);
    });

    it("returns empty array for unknown channel", async () => {
      const adapter = getAdapter();
      const messages = await adapter.getMessagesForChannel("nonexistent");
      assert.deepEqual(messages, []);
    });

    it("deletes a channel", async () => {
      const adapter = getAdapter();
      await adapter.appendMessage("ch1", { channel: "ch1", from: "a", content: "msg", timestamp: Date.now() });
      await adapter.deleteChannel("ch1");

      const messages = await adapter.getMessagesForChannel("ch1");
      assert.deepEqual(messages, []);
    });

    it("resets index after channel delete", async () => {
      const adapter = getAdapter();
      await adapter.appendMessage("ch1", { channel: "ch1", from: "a", content: "msg", timestamp: Date.now() });
      await adapter.appendMessage("ch1", { channel: "ch1", from: "a", content: "msg2", timestamp: Date.now() });
      await adapter.deleteChannel("ch1");

      const msg = await adapter.appendMessage("ch1", { channel: "ch1", from: "a", content: "new", timestamp: Date.now() });
      assert.equal(msg.index, 1);
    });

    it("preserves to and type fields", async () => {
      const adapter = getAdapter();
      const msg = await adapter.appendMessage("ch1", {
        channel: "ch1",
        from: "alice",
        to: "bob",
        content: "private",
        timestamp: Date.now(),
        type: "whisper",
      });

      const messages = await adapter.getMessagesForChannel("ch1");
      assert.equal(messages[0].to, "bob");
      assert.equal(messages[0].type, "whisper");
    });
  });
}

// ── User storage tests ──────────────────────────────────────────────

function userTests(name: string, getAdapter: () => UserStorageAdapter) {
  describe(`UserStorageAdapter (${name})`, () => {
    it("creates and retrieves a user", async () => {
      const adapter = getAdapter();
      await adapter.setUser("u1", { username: "alice", model: "gpt-4" });

      const user = await adapter.getUser("u1");
      assert.equal(user?.userId, "u1");
      assert.equal(user?.username, "alice");
      assert.equal(user?.model, "gpt-4");
    });

    it("returns undefined for unknown user", async () => {
      const adapter = getAdapter();
      assert.equal(await adapter.getUser("unknown"), undefined);
    });

    it("updates existing user partially", async () => {
      const adapter = getAdapter();
      await adapter.setUser("u1", { username: "alice", model: "gpt-4" });
      await adapter.setUser("u1", { model: "claude" });

      const user = await adapter.getUser("u1");
      assert.equal(user?.username, "alice");
      assert.equal(user?.model, "claude");
    });

    it("batch retrieves users", async () => {
      const adapter = getAdapter();
      await adapter.setUser("u1", { username: "alice" });
      await adapter.setUser("u2", { username: "bob" });

      const users = await adapter.getUsers(["u1", "u2", "u3"]);
      assert.equal(Object.keys(users).length, 2);
      assert.equal(users.u1.username, "alice");
      assert.equal(users.u2.username, "bob");
    });

    it("lists all users", async () => {
      const adapter = getAdapter();
      await adapter.setUser("u1", { username: "alice" });
      await adapter.setUser("u2", { username: "bob" });

      const list = await adapter.listUsers();
      assert.equal(list.length, 2);
    });

    it("clears all data", async () => {
      const adapter = getAdapter();
      await adapter.setUser("u1", { username: "alice" });
      await adapter.clearRuntimeState();

      assert.equal(await adapter.getUser("u1"), undefined);
      assert.deepEqual(await adapter.listUsers(), []);
    });
  });
}

// ── Run against in-memory ───────────────────────────────────────────

describe("In-memory adapters", () => {
  let arena: InMemoryArenaStorageAdapter;
  let chat: InMemoryChatStorageAdapter;
  let user: InMemoryUserStorageAdapter;

  beforeEach(() => {
    arena = new InMemoryArenaStorageAdapter();
    chat = new InMemoryChatStorageAdapter();
    user = new InMemoryUserStorageAdapter();
  });

  arenaTests("in-memory", () => arena);
  chatTests("in-memory", () => chat);
  userTests("in-memory", () => user);
});

// ── Run against SQL (PGlite) ────────────────────────────────────────

describe("SQL adapters (PGlite)", () => {
  let testDb: TestStorage;

  before(async () => {
    testDb = await createTestDb();
  });

  after(async () => {
    await testDb.cleanup();
  });

  beforeEach(async () => {
    await resetTestDb(testDb.db);
  });

  arenaTests("sql", () => testDb.arena);
  chatTests("sql", () => testDb.chat);
  userTests("sql", () => testDb.user);
});
