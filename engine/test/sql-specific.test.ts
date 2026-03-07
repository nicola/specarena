import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { createTestDb, resetTestDb, type TestStorage } from "./helpers/test-db";
import type { Challenge } from "../types";

function mockChallenge(id: string, invites: string[]): Challenge {
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
  };
}

describe("SQL-specific behavior", () => {
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

  describe("Chat: concurrent appendMessage", () => {
    it("assigns unique sequential indexes under concurrent writes", async () => {
      const promises = Array.from({ length: 20 }, (_, i) =>
        testDb.chat.appendMessage("ch1", {
          channel: "ch1",
          from: `user_${i}`,
          content: `message ${i}`,
          timestamp: Date.now(),
        }),
      );

      const results = await Promise.all(promises);
      const indexes = results.map((m) => m.index).sort((a, b) => a - b);

      // All indexes should be unique
      assert.equal(new Set(indexes).size, 20);
      // Should be 1..20
      assert.deepEqual(indexes, Array.from({ length: 20 }, (_, i) => i + 1));
    });

    it("concurrent writes to different channels don't interfere", async () => {
      const promises = [
        testDb.chat.appendMessage("ch1", { channel: "ch1", from: "a", content: "a1", timestamp: Date.now() }),
        testDb.chat.appendMessage("ch2", { channel: "ch2", from: "b", content: "b1", timestamp: Date.now() }),
        testDb.chat.appendMessage("ch1", { channel: "ch1", from: "a", content: "a2", timestamp: Date.now() }),
        testDb.chat.appendMessage("ch2", { channel: "ch2", from: "b", content: "b2", timestamp: Date.now() }),
      ];

      await Promise.all(promises);

      const ch1 = await testDb.chat.getMessagesForChannel("ch1");
      const ch2 = await testDb.chat.getMessagesForChannel("ch2");

      assert.equal(ch1.length, 2);
      assert.equal(ch2.length, 2);

      // Each channel has its own index sequence
      const ch1Indexes = ch1.map((m) => m.index).sort((a, b) => a - b);
      const ch2Indexes = ch2.map((m) => m.index).sort((a, b) => a - b);
      assert.deepEqual(ch1Indexes, [1, 2]);
      assert.deepEqual(ch2Indexes, [1, 2]);
    });
  });

  describe("Arena: cascade delete", () => {
    it("deleting a challenge cascades to invites", async () => {
      await testDb.arena.setChallenge(mockChallenge("c1", ["inv_a", "inv_b"]));
      await testDb.arena.deleteChallenge("c1");

      assert.equal(await testDb.arena.getChallengeFromInvite("inv_a"), undefined);
      assert.equal(await testDb.arena.getChallengeFromInvite("inv_b"), undefined);
    });
  });

  describe("Arena: concurrent setChallenge (upsert)", () => {
    it("concurrent upserts don't lose data", async () => {
      const c = mockChallenge("c1", ["inv_a", "inv_b"]);
      // Two concurrent writes to same challenge
      await Promise.all([
        testDb.arena.setChallenge({ ...c, name: "write1" }),
        testDb.arena.setChallenge({ ...c, name: "write2" }),
      ]);

      const result = await testDb.arena.getChallenge("c1");
      assert.ok(result);
      // One of the writes should have won
      assert.ok(result.name === "write1" || result.name === "write2");
    });
  });

  describe("Arena: player identity round-trip", () => {
    it("stores and recovers playerIdentities from invites table", async () => {
      const c = mockChallenge("c1", ["inv_a", "inv_b"]);
      c.state.players = ["inv_a", "inv_b"];
      c.state.playerIdentities = { inv_a: "user1", inv_b: "user2" };
      await testDb.arena.setChallenge(c);

      const result = await testDb.arena.getChallenge("c1");
      assert.deepEqual(result?.state.players, ["inv_a", "inv_b"]);
      assert.deepEqual(result?.state.playerIdentities, { inv_a: "user1", inv_b: "user2" });
    });

    it("getChallengesByUserId uses the invites table", async () => {
      const c1 = mockChallenge("c1", ["inv_a"]);
      c1.state.playerIdentities = { inv_a: "user1" };
      c1.state.players = ["inv_a"];

      const c2 = mockChallenge("c2", ["inv_b"]);
      c2.state.playerIdentities = { inv_b: "user2" };
      c2.state.players = ["inv_b"];

      await testDb.arena.setChallenge(c1);
      await testDb.arena.setChallenge(c2);

      const results = await testDb.arena.getChallengesByUserId("user1");
      assert.equal(results.length, 1);
      assert.equal(results[0].id, "c1");
    });
  });

  describe("User: upsert behavior", () => {
    it("partial update preserves existing fields", async () => {
      await testDb.user.setUser("u1", { username: "alice", model: "gpt-4" });
      await testDb.user.setUser("u1", { model: "claude" });

      const user = await testDb.user.getUser("u1");
      assert.equal(user?.username, "alice");
      assert.equal(user?.model, "claude");
    });
  });
});
