import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, resetTestDb, type TestStorage } from "./helpers/test-db";
import type { Challenge } from "../types";
import { ChallengeStatus } from "../types";
import { ScoringModule } from "../scoring/index";
import type { GameResult, EngineConfig, ScoringEntry } from "../scoring/types";
import { SqlScoringStorageAdapter } from "@specarena/scoring/sql";
import { strategies, globalStrategies } from "@specarena/scoring";

function mockChallenge(id: string, invites: string[]): Challenge {
  return {
    id,
    name: "test",
    challengeType: "test",
    createdAt: Date.now(),
    invites,
    gameState: {},
    state: {
      status: ChallengeStatus.Open,
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

      const { items: results } = await testDb.arena.getChallengesByUserId("user1");
      assert.equal(results.length, 1);
      assert.equal(results[0].id, "c1");
    });
  });

  describe("Arena: scores stored in game_scores table", () => {
    it("writes scores to game_scores and reads them back", async () => {
      const c = mockChallenge("c1", ["inv_a", "inv_b"]);
      c.state.players = ["inv_a", "inv_b"];
      c.state.scores = [{ security: 0.8, utility: 0.6 }, { security: 0.3, utility: 0.9 }];
      c.state.status = "ended";
      await testDb.arena.setChallenge(c);

      // Verify raw game_scores rows
      const rows = await testDb.db
        .selectFrom("game_scores")
        .selectAll()
        .where("challenge_id", "=", "c1")
        .orderBy("player_id")
        .execute();

      assert.equal(rows.length, 2);
      assert.equal(rows[0].player_id, "inv_a");
      assert.equal(rows[0].security, 0.8);
      assert.equal(rows[0].utility, 0.6);
      assert.equal(rows[1].player_id, "inv_b");
      assert.equal(rows[1].security, 0.3);
      assert.equal(rows[1].utility, 0.9);

      // Verify round-trip through getChallenge
      const result = await testDb.arena.getChallenge("c1");
      assert.deepEqual(result?.state.scores, c.state.scores);
    });

    it("returns default scores for players who haven't joined yet", async () => {
      const c = mockChallenge("c1", ["inv_a", "inv_b"]);
      // No players joined, no scores set
      await testDb.arena.setChallenge(c);

      const result = await testDb.arena.getChallenge("c1");
      assert.deepEqual(result?.state.scores, [
        { security: 0, utility: 0 },
        { security: 0, utility: 0 },
      ]);

      // No rows in game_scores
      const rows = await testDb.db
        .selectFrom("game_scores")
        .selectAll()
        .where("challenge_id", "=", "c1")
        .execute();
      assert.equal(rows.length, 0);
    });

    it("writes game_scores during gameplay for mid-game round-trips", async () => {
      const c = mockChallenge("c1", ["inv_a", "inv_b"]);
      c.state.players = ["inv_a", "inv_b"];
      c.state.scores = [{ security: 0.5, utility: 0.5 }, { security: 0.5, utility: 0.5 }];
      c.state.status = "active";
      // gameEnded is still false
      await testDb.arena.setChallenge(c);

      const rows = await testDb.db
        .selectFrom("game_scores")
        .selectAll()
        .where("challenge_id", "=", "c1")
        .execute();
      assert.equal(rows.length, 2);

      // Verify round-trip
      const result = await testDb.arena.getChallenge("c1");
      assert.deepEqual(result?.state.scores, c.state.scores);
    });

    it("defaults to zero scores for players with missing score entries", async () => {
      const c = mockChallenge("c1", ["inv_a", "inv_b"]);
      c.state.players = ["inv_a", "inv_b"];
      // Only first player has a score; second player's score is missing
      c.state.scores = [{ security: 0.7, utility: 0.4 }];
      c.state.status = "active";
      await testDb.arena.setChallenge(c);

      // Both players should have rows in game_scores
      const rows = await testDb.db
        .selectFrom("game_scores")
        .selectAll()
        .where("challenge_id", "=", "c1")
        .orderBy("player_id")
        .execute();

      assert.equal(rows.length, 2, "should persist a score row for every player");
      assert.equal(rows[0].player_id, "inv_a");
      assert.equal(rows[0].security, 0.7);
      assert.equal(rows[0].utility, 0.4);
      assert.equal(rows[1].player_id, "inv_b");
      assert.equal(rows[1].security, 0, "missing score should default to 0");
      assert.equal(rows[1].utility, 0, "missing score should default to 0");

      // Round-trip should also reflect the default
      const result = await testDb.arena.getChallenge("c1");
      assert.deepEqual(result?.state.scores, [
        { security: 0.7, utility: 0.4 },
        { security: 0, utility: 0 },
      ]);
    });

    it("cascade-deletes game_scores when challenge is deleted", async () => {
      const c = mockChallenge("c1", ["inv_a", "inv_b"]);
      c.state.players = ["inv_a", "inv_b"];
      c.state.status = "ended";
      c.state.scores = [{ security: 1, utility: 1 }, { security: 0, utility: 0 }];
      await testDb.arena.setChallenge(c);
      await testDb.arena.deleteChallenge("c1");

      const rows = await testDb.db
        .selectFrom("game_scores")
        .selectAll()
        .where("challenge_id", "=", "c1")
        .execute();
      assert.equal(rows.length, 0);
    });
  });

  describe("Arena: attributions stored in scoring_attributions table", () => {
    it("writes attributions to scoring_attributions and reads them back", async () => {
      const c = mockChallenge("c1", ["inv_a", "inv_b"]);
      c.state.players = ["inv_a", "inv_b"];
      c.state.attributions = [
        { from: 0, to: 1, type: "security_breach" },
        { from: 1, to: 0, type: "data_leak" },
      ];
      c.state.status = "ended";
      await testDb.arena.setChallenge(c);

      // Verify raw scoring_attributions rows
      const rows = await testDb.db
        .selectFrom("scoring_attributions")
        .selectAll()
        .where("challenge_id", "=", "c1")
        .execute();

      assert.equal(rows.length, 2);
      const sorted = rows.sort((a, b) => a.from_player_index - b.from_player_index);
      assert.equal(sorted[0].from_player_index, 0);
      assert.equal(sorted[0].to_player_index, 1);
      assert.equal(sorted[0].type, "security_breach");
      assert.equal(sorted[1].from_player_index, 1);
      assert.equal(sorted[1].to_player_index, 0);
      assert.equal(sorted[1].type, "data_leak");

      // Verify round-trip through getChallenge
      const result = await testDb.arena.getChallenge("c1");
      assert.equal(result?.state.attributions?.length, 2);
      assert.deepEqual(
        result?.state.attributions?.sort((a, b) => a.from - b.from),
        c.state.attributions,
      );
    });

    it("returns undefined attributions when none exist", async () => {
      const c = mockChallenge("c1", ["inv_a"]);
      await testDb.arena.setChallenge(c);

      const result = await testDb.arena.getChallenge("c1");
      assert.equal(result?.state.attributions, undefined);
    });

    it("updates attributions when challenge is re-saved", async () => {
      const c = mockChallenge("c1", ["inv_a", "inv_b"]);
      c.state.players = ["inv_a", "inv_b"];
      c.state.status = "ended";
      c.state.attributions = [{ from: 0, to: 1, type: "breach" }];
      await testDb.arena.setChallenge(c);

      c.state.attributions = [
        { from: 0, to: 1, type: "breach" },
        { from: 1, to: 0, type: "breach" },
      ];
      await testDb.arena.setChallenge(c);

      const rows = await testDb.db
        .selectFrom("scoring_attributions")
        .selectAll()
        .where("challenge_id", "=", "c1")
        .execute();
      assert.equal(rows.length, 2);
    });

    it("cascade-deletes attributions when challenge is deleted", async () => {
      const c = mockChallenge("c1", ["inv_a", "inv_b"]);
      c.state.players = ["inv_a", "inv_b"];
      c.state.status = "ended";
      c.state.attributions = [{ from: 0, to: 1, type: "breach" }];
      await testDb.arena.setChallenge(c);
      await testDb.arena.deleteChallenge("c1");

      const rows = await testDb.db
        .selectFrom("scoring_attributions")
        .selectAll()
        .where("challenge_id", "=", "c1")
        .execute();
      assert.equal(rows.length, 0);
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

  describe("ScoringModule with SQL storage", () => {
    const testConfig: EngineConfig = {
      challenges: [{ name: "psi", scoring: ["win-rate"] }],
      scoring: { default: ["average"], global: "global-average" },
    };

    function makeGameResult(overrides: Partial<GameResult> = {}): GameResult {
      return {
        gameId: "game-1",
        challengeType: "psi",
        createdAt: Date.now(),
        completedAt: Date.now(),
        scores: [
          { security: 1, utility: 0.8 },
          { security: 0.5, utility: 1 },
        ],
        players: ["inv_a", "inv_b"],
        playerIdentities: { inv_a: "user-alice", inv_b: "user-bob" },
        ...overrides,
      };
    }

    it("persists scoring metrics to scoring_metrics table", async () => {
      const scoringStore = new SqlScoringStorageAdapter(testDb.db);
      const scoring = new ScoringModule(testConfig, strategies, globalStrategies, scoringStore);

      await scoring.recordGame(makeGameResult());

      // Verify rows in scoring_metrics table
      const rows = await testDb.db
        .selectFrom("scoring_metrics")
        .selectAll()
        .execute();

      assert.ok(rows.length > 0, "scoring_metrics should have rows");

      // Check that alice's average scores are stored
      const aliceAvgSecurity = rows.find(
        (r) => r.player_id === "user-alice" && r.strategy_name === "average" && r.metric_key === "average:security",
      );
      assert.ok(aliceAvgSecurity, "should have alice average:security");
      assert.equal(aliceAvgSecurity!.value, 1);

      // Check games played count
      const aliceGamesPlayed = rows.find(
        (r) => r.player_id === "user-alice" && r.strategy_name === "average" && r.metric_key === "gameplayed:count",
      );
      assert.ok(aliceGamesPlayed);
      assert.equal(aliceGamesPlayed!.value, 1);
    });

    it("persists strategy state to scoring_strategy_state table", async () => {
      const scoringStore = new SqlScoringStorageAdapter(testDb.db);
      const scoring = new ScoringModule(testConfig, strategies, globalStrategies, scoringStore);

      await scoring.recordGame(makeGameResult());

      const rows = await testDb.db
        .selectFrom("scoring_strategy_state")
        .selectAll()
        .execute();

      assert.ok(rows.length > 0, "scoring_strategy_state should have rows");
    });

    it("scores survive across ScoringModule instances (persistence)", async () => {
      const scoringStore = new SqlScoringStorageAdapter(testDb.db);

      // First instance records a game
      const scoring1 = new ScoringModule(testConfig, strategies, globalStrategies, scoringStore);
      await scoring1.recordGame(makeGameResult({ gameId: "game-1" }));

      // Second instance (simulating server restart) can read scores
      const scoring2 = new ScoringModule(testConfig, strategies, globalStrategies, scoringStore);
      const scores = await scoring2.getScoring("psi");

      assert.ok(scores["average"]);
      const alice = scores["average"].find((e: ScoringEntry) => e.playerId === "user-alice");
      assert.ok(alice);
      assert.equal(alice.gamesPlayed, 1);
      assert.equal(alice.metrics["average:security"], 1);
      assert.equal(alice.metrics["average:utility"], 0.8);
    });
  });
});
