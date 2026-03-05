import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Kysely, Migrator, SqliteDialect } from "kysely";
import Database from "better-sqlite3";
import type { Database as DatabaseSchema } from "../schema";
import { StaticMigrationProvider } from "../migrations";
import { SqlUserStorageAdapter } from "../SqlUserStorageAdapter";
import { SqlChatStorageAdapter } from "../SqlChatStorageAdapter";
import { SqlScoringStorageAdapter } from "../SqlScoringStorageAdapter";
import { SqlArenaStorageAdapter } from "../SqlArenaStorageAdapter";
import type {
  ChallengeOperator,
  ChallengeOperatorState,
  ChatMessage,
} from "../../../types";
import { createTestDb, migrate } from "./test-helpers";

function mockOperator(
  overrides: Partial<ChallengeOperatorState> = {}
): ChallengeOperator {
  const state: ChallengeOperatorState = {
    gameStarted: false,
    gameEnded: false,
    scores: [],
    players: [],
    playerIdentities: {},
    ...overrides,
  };
  return {
    state,
    async join() {},
    async message() {},
    serialize() { return null; },
    restore() {},
  };
}

// ── Migrations ───────────────────────────────────────────────
describe("Migrations", () => {
  it("migrateToLatest is idempotent", async () => {
    const db = createTestDb();
    await migrate(db);
    // Running again should be a no-op
    const migrator = new Migrator({
      db,
      provider: new StaticMigrationProvider(),
    });
    const { error, results } = await migrator.migrateToLatest();
    assert.equal(error, undefined);
    assert.equal(results?.length, 0);
  });

  it("creates all 9 tables", async () => {
    const sqliteDb = new Database(":memory:");
    sqliteDb.pragma("foreign_keys = ON");
    const db = new Kysely<DatabaseSchema>({
      dialect: new SqliteDialect({ database: sqliteDb }),
    });
    await migrate(db);

    const tables = sqliteDb
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name != 'kysely_migration' AND name != 'kysely_migration_lock' ORDER BY name`
      )
      .all()
      .map((r: any) => r.name);

    assert.deepEqual(tables, [
      "challenge_attributions",
      "challenge_invites",
      "challenge_scores",
      "challenges",
      "chat_channel_counters",
      "chat_messages",
      "score_metrics",
      "strategy_state",
      "users",
    ]);
  });

  it("foreign keys cascade on delete", async () => {
    const db = createTestDb();
    await migrate(db);

    // Insert a challenge + invite directly
    await db
      .insertInto("challenges")
      .values({
        id: "c1",
        name: "test",
        challenge_type: "psi",
        created_at: 1000,
        game_started: 0,
        game_ended: 0,
        completed_at: null,
        game_state: null,
      })
      .execute();
    await db
      .insertInto("challenge_invites")
      .values({
        invite: "inv1",
        challenge_id: "c1",
        player_index: 0,
        user_id: null,
      })
      .execute();
    await db
      .insertInto("challenge_scores")
      .values({
        challenge_id: "c1",
        player_index: 0,
        security: 1,
        utility: 1,
      })
      .execute();

    // Delete the challenge — invites and scores should cascade
    await db.deleteFrom("challenges").where("id", "=", "c1").execute();

    const invites = await db.selectFrom("challenge_invites").selectAll().execute();
    const scores = await db.selectFrom("challenge_scores").selectAll().execute();
    assert.equal(invites.length, 0);
    assert.equal(scores.length, 0);
  });
});

// ── SqlUserStorageAdapter ────────────────────────────────────
describe("SqlUserStorageAdapter", () => {
  let db: Kysely<DatabaseSchema>;
  let adapter: SqlUserStorageAdapter;

  beforeEach(async () => {
    db = createTestDb();
    await migrate(db);
    adapter = new SqlUserStorageAdapter(db);
  });

  it("returns undefined for nonexistent user", async () => {
    assert.equal(await adapter.getUser("nobody"), undefined);
  });

  it("setUser creates and returns a user", async () => {
    const user = await adapter.setUser("u1", {
      username: "alice",
      model: "gpt-4",
    });
    assert.deepEqual(user, {
      userId: "u1",
      username: "alice",
      model: "gpt-4",
    });
  });

  it("setUser upserts on conflict", async () => {
    await adapter.setUser("u1", { username: "alice" });
    const updated = await adapter.setUser("u1", { username: "bob" });
    assert.equal(updated.username, "bob");
    assert.equal((await adapter.getUser("u1"))?.username, "bob");
  });

  it("setUser merges partial updates with existing data", async () => {
    await adapter.setUser("u1", { username: "alice", model: "gpt-4" });
    const updated = await adapter.setUser("u1", { username: "bob" });
    assert.equal(updated.username, "bob");
    assert.equal(updated.model, "gpt-4"); // preserved from first call
  });

  it("setUser with empty updates returns minimal profile", async () => {
    const user = await adapter.setUser("u1", {});
    assert.equal(user.userId, "u1");
    assert.equal(user.username, undefined);
    assert.equal(user.model, undefined);
  });

  it("getUsers returns a map of matching users", async () => {
    await adapter.setUser("u1", { username: "a" });
    await adapter.setUser("u2", { username: "b" });
    const result = await adapter.getUsers(["u1", "u3"]);
    assert.equal(Object.keys(result).length, 1);
    assert.equal(result.u1.username, "a");
  });

  it("getUsers with empty array returns empty map", async () => {
    const result = await adapter.getUsers([]);
    assert.deepEqual(result, {});
  });

  it("listUsers returns all users", async () => {
    await adapter.setUser("u1", { username: "a" });
    await adapter.setUser("u2", { username: "b" });
    const list = await adapter.listUsers();
    assert.equal(list.length, 2);
  });

  it("listUsers returns empty array when no users exist", async () => {
    assert.deepEqual(await adapter.listUsers(), []);
  });

  it("clearRuntimeState removes all users", async () => {
    await adapter.setUser("u1", { username: "a" });
    await adapter.clearRuntimeState();
    assert.equal((await adapter.listUsers()).length, 0);
  });

  it("profile omits null fields", async () => {
    await adapter.setUser("u1", { username: "alice" });
    const user = await adapter.getUser("u1");
    assert.ok(user);
    assert.equal(user.userId, "u1");
    assert.equal(user.username, "alice");
    // model should not be present (not set)
    assert.equal("model" in user, false);
  });
});

// ── SqlChatStorageAdapter ────────────────────────────────────
describe("SqlChatStorageAdapter", () => {
  let db: Kysely<DatabaseSchema>;
  let adapter: SqlChatStorageAdapter;

  beforeEach(async () => {
    db = createTestDb();
    await migrate(db);
    adapter = new SqlChatStorageAdapter(db);
  });

  it("getNextIndex starts at 1 for a new channel", async () => {
    assert.equal(await adapter.getNextIndex("ch1"), 1);
  });

  it("getNextIndex increments after messages are appended", async () => {
    await adapter.appendMessage("ch1", {
      channel: "ch1",
      from: "alice",
      content: "hello",
      index: 1,
      timestamp: Date.now(),
    });
    assert.equal(await adapter.getNextIndex("ch1"), 2);
  });

  it("getNextIndex tracks multiple messages", async () => {
    for (let i = 1; i <= 5; i++) {
      await adapter.appendMessage("ch1", {
        channel: "ch1",
        from: "alice",
        content: `msg${i}`,
        index: i,
        timestamp: 1000 + i,
      });
    }
    assert.equal(await adapter.getNextIndex("ch1"), 6);
  });

  it("getNextIndex is per-channel", async () => {
    await adapter.appendMessage("ch1", {
      channel: "ch1",
      from: "a",
      content: "x",
      index: 1,
      timestamp: 1000,
    });
    await adapter.appendMessage("ch1", {
      channel: "ch1",
      from: "a",
      content: "y",
      index: 2,
      timestamp: 1001,
    });
    // ch2 is independent
    assert.equal(await adapter.getNextIndex("ch2"), 1);
    assert.equal(await adapter.getNextIndex("ch1"), 3);
  });

  it("getMessagesForChannel returns messages in order", async () => {
    for (let i = 1; i <= 3; i++) {
      await adapter.appendMessage("ch1", {
        channel: "ch1",
        from: "alice",
        content: `msg${i}`,
        index: i,
        timestamp: 1000 + i,
      });
    }
    const msgs = await adapter.getMessagesForChannel("ch1");
    assert.equal(msgs.length, 3);
    assert.equal(msgs[0].content, "msg1");
    assert.equal(msgs[1].content, "msg2");
    assert.equal(msgs[2].content, "msg3");
  });

  it("getMessagesForChannel returns empty for unknown channel", async () => {
    assert.deepEqual(await adapter.getMessagesForChannel("unknown"), []);
  });

  it("channels are isolated", async () => {
    await adapter.appendMessage("ch1", {
      channel: "ch1",
      from: "a",
      content: "msg-ch1",
      index: 1,
      timestamp: 1000,
    });
    await adapter.appendMessage("ch2", {
      channel: "ch2",
      from: "b",
      content: "msg-ch2",
      index: 1,
      timestamp: 1000,
    });
    const ch1 = await adapter.getMessagesForChannel("ch1");
    const ch2 = await adapter.getMessagesForChannel("ch2");
    assert.equal(ch1.length, 1);
    assert.equal(ch1[0].content, "msg-ch1");
    assert.equal(ch2.length, 1);
    assert.equal(ch2[0].content, "msg-ch2");
  });

  it("deleteChannel removes all messages for that channel only", async () => {
    await adapter.appendMessage("ch1", {
      channel: "ch1",
      from: "a",
      content: "x",
      index: 1,
      timestamp: 1000,
    });
    await adapter.appendMessage("ch2", {
      channel: "ch2",
      from: "a",
      content: "y",
      index: 1,
      timestamp: 1000,
    });
    await adapter.deleteChannel("ch1");
    assert.equal((await adapter.getMessagesForChannel("ch1")).length, 0);
    assert.equal((await adapter.getMessagesForChannel("ch2")).length, 1);
    // getNextIndex resets after delete
    assert.equal(await adapter.getNextIndex("ch1"), 1);
  });

  it("deleteChannel is safe on nonexistent channel", async () => {
    await adapter.deleteChannel("nonexistent"); // should not throw
  });

  it("preserves to and type fields", async () => {
    await adapter.appendMessage("ch1", {
      channel: "ch1",
      from: "alice",
      to: "bob",
      content: "secret",
      index: 1,
      timestamp: 1000,
      type: "dm",
    });
    const msgs = await adapter.getMessagesForChannel("ch1");
    assert.equal(msgs[0].to, "bob");
    assert.equal(msgs[0].type, "dm");
    assert.equal(msgs[0].from, "alice");
    assert.equal(msgs[0].content, "secret");
    assert.equal(msgs[0].timestamp, 1000);
  });

  it("null to and type are omitted from result", async () => {
    await adapter.appendMessage("ch1", {
      channel: "ch1",
      from: "alice",
      content: "broadcast",
      index: 1,
      timestamp: 1000,
    });
    const msgs = await adapter.getMessagesForChannel("ch1");
    assert.equal("to" in msgs[0], false);
    assert.equal("type" in msgs[0], false);
  });

  it("handles empty content", async () => {
    await adapter.appendMessage("ch1", {
      channel: "ch1",
      from: "alice",
      content: "",
      index: 1,
      timestamp: 1000,
    });
    const msgs = await adapter.getMessagesForChannel("ch1");
    assert.equal(msgs[0].content, "");
  });

  it("getNextIndex uses counter table, not MAX scan", async () => {
    // Counter increments atomically with each append, independent of message content.
    for (let i = 0; i < 3; i++) {
      await adapter.appendMessage("ch1", {
        channel: "ch1",
        from: "alice",
        content: `msg${i}`,
        timestamp: 1000 + i,
      });
    }
    // 3 messages appended → counter is at 3, next is 4
    assert.equal(await adapter.getNextIndex("ch1"), 4);
  });

  it("clearRuntimeState removes all messages across all channels", async () => {
    await adapter.appendMessage("ch1", {
      channel: "ch1",
      from: "a",
      content: "x",
      index: 1,
      timestamp: 1000,
    });
    await adapter.appendMessage("ch2", {
      channel: "ch2",
      from: "a",
      content: "y",
      index: 1,
      timestamp: 1000,
    });
    await adapter.clearRuntimeState();
    assert.equal((await adapter.getMessagesForChannel("ch1")).length, 0);
    assert.equal((await adapter.getMessagesForChannel("ch2")).length, 0);
  });
});

// ── SqlScoringStorageAdapter ─────────────────────────────────
describe("SqlScoringStorageAdapter", () => {
  let db: Kysely<DatabaseSchema>;
  let adapter: SqlScoringStorageAdapter;

  beforeEach(async () => {
    db = createTestDb();
    await migrate(db);
    adapter = new SqlScoringStorageAdapter(db);
  });

  it("getScores returns empty for unknown challenge type", async () => {
    const scores = await adapter.getScores("unknown");
    assert.deepEqual(scores, {});
  });

  it("setScoreEntry and getScoreEntry round-trip", async () => {
    await adapter.setScoreEntry("psi", "elo", {
      playerId: "p1",
      metrics: { elo: 1200, winRate: 0.6 },
    });

    const entry = await adapter.getScoreEntry("psi", "elo", "p1");
    assert.ok(entry);
    assert.equal(entry.playerId, "p1");
    assert.equal(entry.metrics.elo, 1200);
    assert.equal(entry.metrics.winRate, 0.6);
  });

  it("setScoreEntry replaces existing metrics completely", async () => {
    await adapter.setScoreEntry("psi", "elo", {
      playerId: "p1",
      metrics: { elo: 1200, winRate: 0.6 },
    });
    await adapter.setScoreEntry("psi", "elo", {
      playerId: "p1",
      metrics: { elo: 1250 },
    });

    const entry = await adapter.getScoreEntry("psi", "elo", "p1");
    assert.ok(entry);
    assert.equal(entry.metrics.elo, 1250);
    assert.equal(entry.metrics.winRate, undefined); // removed
  });

  it("getScoreEntry returns undefined for nonexistent player", async () => {
    assert.equal(
      await adapter.getScoreEntry("psi", "elo", "nobody"),
      undefined
    );
  });

  it("getScores groups by strategy name", async () => {
    await adapter.setScoreEntry("psi", "elo", {
      playerId: "p1",
      metrics: { elo: 1000 },
    });
    await adapter.setScoreEntry("psi", "winrate", {
      playerId: "p1",
      metrics: { rate: 0.5 },
    });
    const scores = await adapter.getScores("psi");
    assert.ok(scores.elo);
    assert.ok(scores.winrate);
    assert.equal(scores.elo.length, 1);
    assert.equal(scores.winrate.length, 1);
  });

  it("getScores returns multiple players per strategy", async () => {
    await adapter.setScoreEntry("psi", "avg", {
      playerId: "alice",
      metrics: { security: 0.8, utility: 0.9 },
    });
    await adapter.setScoreEntry("psi", "avg", {
      playerId: "bob",
      metrics: { security: 0.6, utility: 0.7 },
    });

    const scores = await adapter.getScores("psi");
    assert.equal(scores.avg.length, 2);
    const alice = scores.avg.find((e) => e.playerId === "alice");
    const bob = scores.avg.find((e) => e.playerId === "bob");
    assert.ok(alice);
    assert.ok(bob);
    assert.equal(alice.metrics.security, 0.8);
    assert.equal(bob.metrics.security, 0.6);
  });

  it("challenge types are isolated", async () => {
    await adapter.setScoreEntry("psi", "avg", {
      playerId: "p1",
      metrics: { x: 1 },
    });
    await adapter.setScoreEntry("other", "avg", {
      playerId: "p1",
      metrics: { x: 2 },
    });

    const psi = await adapter.getScores("psi");
    const other = await adapter.getScores("other");
    assert.equal(psi.avg[0].metrics.x, 1);
    assert.equal(other.avg[0].metrics.x, 2);
  });

  it("global score entry round-trips", async () => {
    await adapter.setGlobalScoreEntry({
      playerId: "p1",
      metrics: { totalElo: 2000 },
    });
    const entry = await adapter.getGlobalScoreEntry("p1");
    assert.ok(entry);
    assert.equal(entry.metrics.totalElo, 2000);
  });

  it("getGlobalScoreEntry returns undefined for nonexistent", async () => {
    assert.equal(await adapter.getGlobalScoreEntry("nobody"), undefined);
  });

  it("getGlobalScores returns all global entries", async () => {
    await adapter.setGlobalScoreEntry({
      playerId: "p1",
      metrics: { x: 1 },
    });
    await adapter.setGlobalScoreEntry({
      playerId: "p2",
      metrics: { x: 2 },
    });
    const all = await adapter.getGlobalScores();
    assert.equal(all.length, 2);
  });

  it("getGlobalScores returns empty array when none exist", async () => {
    assert.deepEqual(await adapter.getGlobalScores(), []);
  });

  it("strategy state round-trips", async () => {
    await adapter.setStrategyState("psi", "elo", "p1", {
      sum: 100,
      count: 5,
    });
    const state = await adapter.getStrategyState<{
      sum: number;
      count: number;
    }>("psi", "elo", "p1");
    assert.ok(state);
    assert.equal(state.sum, 100);
    assert.equal(state.count, 5);
  });

  it("strategy state upserts on conflict", async () => {
    await adapter.setStrategyState("psi", "elo", "p1", { v: 1 });
    await adapter.setStrategyState("psi", "elo", "p1", { v: 2 });
    const state = await adapter.getStrategyState<{ v: number }>(
      "psi",
      "elo",
      "p1"
    );
    assert.ok(state);
    assert.equal(state.v, 2);
  });

  it("strategy state returns undefined for nonexistent", async () => {
    assert.equal(
      await adapter.getStrategyState("psi", "elo", "nobody"),
      undefined
    );
  });

  it("global strategy state round-trips", async () => {
    await adapter.setGlobalStrategyState("p1", { streak: 3 });
    const state = await adapter.getGlobalStrategyState<{ streak: number }>(
      "p1"
    );
    assert.ok(state);
    assert.equal(state.streak, 3);
  });

  it("global strategy state returns undefined for nonexistent", async () => {
    assert.equal(await adapter.getGlobalStrategyState("nobody"), undefined);
  });

  it("transaction serializes operations", async () => {
    const results: number[] = [];
    await Promise.all([
      adapter.transaction(async () => {
        results.push(1);
        await new Promise((r) => setTimeout(r, 10));
        results.push(2);
      }),
      adapter.transaction(async () => {
        results.push(3);
      }),
    ]);
    await adapter.waitForIdle();
    assert.deepEqual(results, [1, 2, 3]);
  });

  it("transaction returns its result", async () => {
    const result = await adapter.transaction(async () => 42);
    assert.equal(result, 42);
  });

  it("transaction continues after error in previous transaction", async () => {
    // First transaction fails
    await assert.rejects(
      adapter.transaction(async () => {
        throw new Error("boom");
      })
    );
    // Second transaction still runs
    const result = await adapter.transaction(async () => "ok");
    assert.equal(result, "ok");
  });

  it("clear removes all score data and strategy state", async () => {
    await adapter.setScoreEntry("psi", "elo", {
      playerId: "p1",
      metrics: { x: 1 },
    });
    await adapter.setStrategyState("psi", "elo", "p1", { a: 1 });
    await adapter.setGlobalScoreEntry({
      playerId: "p1",
      metrics: { y: 2 },
    });
    await adapter.setGlobalStrategyState("p1", { b: 2 });

    await adapter.clear();

    assert.deepEqual(await adapter.getScores("psi"), {});
    assert.equal(await adapter.getStrategyState("psi", "elo", "p1"), undefined);
    assert.deepEqual(await adapter.getGlobalScores(), []);
    assert.equal(await adapter.getGlobalStrategyState("p1"), undefined);
  });

  it("handles zero and negative metric values", async () => {
    await adapter.setScoreEntry("psi", "avg", {
      playerId: "p1",
      metrics: { security: 0, utility: -1 },
    });
    const entry = await adapter.getScoreEntry("psi", "avg", "p1");
    assert.ok(entry);
    assert.equal(entry.metrics.security, 0);
    assert.equal(entry.metrics.utility, -1);
  });

  it("handles fractional metric values", async () => {
    await adapter.setScoreEntry("psi", "avg", {
      playerId: "p1",
      metrics: { rate: 0.333333 },
    });
    const entry = await adapter.getScoreEntry("psi", "avg", "p1");
    assert.ok(entry);
    assert.equal(entry.metrics.rate, 0.333333);
  });
});

// ── SqlArenaStorageAdapter ───────────────────────────────────
describe("SqlArenaStorageAdapter", () => {
  let db: Kysely<DatabaseSchema>;
  let adapter: SqlArenaStorageAdapter;

  beforeEach(async () => {
    db = createTestDb();
    await migrate(db);
    adapter = new SqlArenaStorageAdapter(db);
  });

  it("getChallenge returns undefined for nonexistent", async () => {
    assert.equal(await adapter.getChallenge("none"), undefined);
  });

  it("getChallengeFromInvite returns undefined for nonexistent", async () => {
    assert.equal(await adapter.getChallengeFromInvite("none"), undefined);
  });

  it("getChallengesByUserId returns empty for unknown user", async () => {
    assert.deepEqual(await adapter.getChallengesByUserId("nobody"), []);
  });

  it("listChallenges returns empty initially", async () => {
    assert.deepEqual(await adapter.listChallenges(), []);
  });

  it("setChallenge + getChallenge round-trip with live operator", async () => {
    const op = mockOperator();
    await adapter.setChallenge({
      id: "c1",
      name: "psi",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["inv1", "inv2"],
      instance: op,
    });

    const c = await adapter.getChallenge("c1");
    assert.ok(c);
    assert.equal(c.id, "c1");
    assert.equal(c.name, "psi");
    assert.equal(c.challengeType, "psi");
    assert.equal(c.createdAt, 1000);
    assert.equal(c.invites.length, 2);
    assert.equal(c.invites[0], "inv1");
    assert.equal(c.invites[1], "inv2");
    // Live operator is preserved (same reference)
    assert.equal(c.instance, op);
  });

  it("setChallenge upserts on conflict", async () => {
    const op1 = mockOperator();
    await adapter.setChallenge({
      id: "c1",
      name: "psi",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["inv1"],
      instance: op1,
    });
    const op2 = mockOperator({ gameStarted: true });
    await adapter.setChallenge({
      id: "c1",
      name: "psi-updated",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["inv1", "inv2"],
      instance: op2,
    });

    const c = await adapter.getChallenge("c1");
    assert.ok(c);
    assert.equal(c.name, "psi-updated");
    assert.equal(c.invites.length, 2);
    assert.equal(c.instance, op2);
  });

  it("getChallengeFromInvite resolves correctly", async () => {
    await adapter.setChallenge({
      id: "c1",
      name: "psi",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["inv_a", "inv_b"],
      instance: mockOperator(),
    });

    const a = await adapter.getChallengeFromInvite("inv_a");
    const b = await adapter.getChallengeFromInvite("inv_b");
    assert.ok(a);
    assert.ok(b);
    assert.equal(a.id, "c1");
    assert.equal(b.id, "c1");
    assert.equal(await adapter.getChallengeFromInvite("inv_x"), undefined);
  });

  it("invite lookup updates when challenge is re-set with different invites", async () => {
    await adapter.setChallenge({
      id: "c1",
      name: "psi",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["old_inv"],
      instance: mockOperator(),
    });
    assert.ok(await adapter.getChallengeFromInvite("old_inv"));

    // Re-set with different invites
    await adapter.setChallenge({
      id: "c1",
      name: "psi",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["new_inv"],
      instance: mockOperator(),
    });
    assert.equal(await adapter.getChallengeFromInvite("old_inv"), undefined);
    assert.ok(await adapter.getChallengeFromInvite("new_inv"));
  });

  it("getChallengesByUserId finds challenges for a user", async () => {
    await adapter.setChallenge({
      id: "c1",
      name: "psi",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["inv1", "inv2"],
      instance: mockOperator({
        players: ["inv1"],
        playerIdentities: { inv1: "user_alice" },
      }),
    });

    const challenges = await adapter.getChallengesByUserId("user_alice");
    assert.equal(challenges.length, 1);
    assert.equal(challenges[0].id, "c1");
  });

  it("getChallengesByUserId returns multiple challenges sorted by created_at DESC", async () => {
    await adapter.setChallenge({
      id: "c1",
      name: "psi",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["inv1"],
      instance: mockOperator({
        players: ["inv1"],
        playerIdentities: { inv1: "alice" },
      }),
    });
    await adapter.setChallenge({
      id: "c2",
      name: "psi",
      createdAt: 2000,
      challengeType: "psi",
      invites: ["inv2"],
      instance: mockOperator({
        players: ["inv2"],
        playerIdentities: { inv2: "alice" },
      }),
    });

    const challenges = await adapter.getChallengesByUserId("alice");
    assert.equal(challenges.length, 2);
    assert.equal(challenges[0].id, "c2"); // newer first
    assert.equal(challenges[1].id, "c1");
  });

  it("getChallengesByUserId deduplicates when user has multiple invites in same challenge", async () => {
    await adapter.setChallenge({
      id: "c1",
      name: "psi",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["inv1", "inv2"],
      instance: mockOperator({
        players: ["inv1", "inv2"],
        // Same user on both invites (self-play)
        playerIdentities: { inv1: "alice", inv2: "alice" },
      }),
    });

    const challenges = await adapter.getChallengesByUserId("alice");
    assert.equal(challenges.length, 1);
  });

  it("setChallenge persists scores and attributions", async () => {
    await adapter.setChallenge({
      id: "c1",
      name: "psi",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["inv1", "inv2"],
      instance: mockOperator({
        gameStarted: true,
        gameEnded: true,
        completedAt: 2000,
        scores: [
          { security: 0.8, utility: 0.9 },
          { security: 0.7, utility: 0.6 },
        ],
        players: ["inv1", "inv2"],
        playerIdentities: { inv1: "u1", inv2: "u2" },
        attributions: [{ from: 0, to: 1, type: "security_breach" }],
      }),
    });

    // Use a fresh adapter to verify DB persistence (not just in-memory operator)
    const adapter2 = new SqlArenaStorageAdapter(db);
    const c = await adapter2.getChallenge("c1");
    assert.ok(c);
    assert.equal(c.instance.state.gameStarted, true);
    assert.equal(c.instance.state.gameEnded, true);
    assert.equal(c.instance.state.completedAt, 2000);
    assert.equal(c.instance.state.scores.length, 2);
    assert.equal(c.instance.state.scores[0].security, 0.8);
    assert.equal(c.instance.state.scores[0].utility, 0.9);
    assert.equal(c.instance.state.scores[1].security, 0.7);
    assert.equal(c.instance.state.scores[1].utility, 0.6);
    assert.ok(c.instance.state.attributions);
    assert.equal(c.instance.state.attributions.length, 1);
    assert.equal(c.instance.state.attributions[0].from, 0);
    assert.equal(c.instance.state.attributions[0].to, 1);
    assert.equal(c.instance.state.attributions[0].type, "security_breach");
  });

  it("setChallenge persists playerIdentities", async () => {
    await adapter.setChallenge({
      id: "c1",
      name: "psi",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["inv1", "inv2"],
      instance: mockOperator({
        players: ["inv1", "inv2"],
        playerIdentities: { inv1: "user_a", inv2: "user_b" },
      }),
    });

    const adapter2 = new SqlArenaStorageAdapter(db);
    const c = await adapter2.getChallenge("c1");
    assert.ok(c);
    assert.deepEqual(c.instance.state.playerIdentities, {
      inv1: "user_a",
      inv2: "user_b",
    });
    // players should only include invites that have user_ids (joined)
    assert.deepEqual(c.instance.state.players, ["inv1", "inv2"]);
  });

  it("setChallenge handles challenge with no scores or attributions", async () => {
    await adapter.setChallenge({
      id: "c1",
      name: "psi",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["inv1"],
      instance: mockOperator(),
    });

    const adapter2 = new SqlArenaStorageAdapter(db);
    const c = await adapter2.getChallenge("c1");
    assert.ok(c);
    assert.deepEqual(c.instance.state.scores, []);
    assert.equal(c.instance.state.attributions, undefined);
  });

  it("setChallenge handles multiple attributions", async () => {
    await adapter.setChallenge({
      id: "c1",
      name: "psi",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["inv1", "inv2"],
      instance: mockOperator({
        gameEnded: true,
        attributions: [
          { from: 0, to: 1, type: "breach_a" },
          { from: 1, to: 0, type: "breach_b" },
          { from: 0, to: 1, type: "breach_c" },
        ],
      }),
    });

    const adapter2 = new SqlArenaStorageAdapter(db);
    const c = await adapter2.getChallenge("c1");
    assert.ok(c);
    assert.equal(c.instance.state.attributions!.length, 3);
  });

  it("deleteChallenge removes challenge and cascades to invites/scores/attributions", async () => {
    await adapter.setChallenge({
      id: "c1",
      name: "psi",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["inv1", "inv2"],
      instance: mockOperator({
        gameEnded: true,
        scores: [{ security: 1, utility: 1 }],
        attributions: [{ from: 0, to: 1, type: "breach" }],
      }),
    });
    await adapter.deleteChallenge("c1");
    assert.equal(await adapter.getChallenge("c1"), undefined);
    assert.equal(await adapter.getChallengeFromInvite("inv1"), undefined);

    // Verify cascade at DB level
    const invites = await db
      .selectFrom("challenge_invites")
      .selectAll()
      .execute();
    const scores = await db
      .selectFrom("challenge_scores")
      .selectAll()
      .execute();
    const attrs = await db
      .selectFrom("challenge_attributions")
      .selectAll()
      .execute();
    assert.equal(invites.length, 0);
    assert.equal(scores.length, 0);
    assert.equal(attrs.length, 0);
  });

  it("deleteChallenge is safe on nonexistent challenge", async () => {
    await adapter.deleteChallenge("nonexistent"); // should not throw
  });

  it("listChallenges returns all challenges ordered by created_at DESC", async () => {
    await adapter.setChallenge({
      id: "c1",
      name: "a",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["i1"],
      instance: mockOperator(),
    });
    await adapter.setChallenge({
      id: "c2",
      name: "b",
      createdAt: 3000,
      challengeType: "psi",
      invites: ["i2"],
      instance: mockOperator(),
    });
    await adapter.setChallenge({
      id: "c3",
      name: "c",
      createdAt: 2000,
      challengeType: "psi",
      invites: ["i3"],
      instance: mockOperator(),
    });
    const list = await adapter.listChallenges();
    assert.equal(list.length, 3);
    assert.equal(list[0].id, "c2"); // newest
    assert.equal(list[1].id, "c3");
    assert.equal(list[2].id, "c1"); // oldest
  });

  it("read-only stub for completed games without live operator", async () => {
    const op = mockOperator({
      gameStarted: true,
      gameEnded: true,
      completedAt: 2000,
      scores: [
        { security: 1, utility: 0.8 },
        { security: 0.5, utility: 1 },
      ],
      players: ["inv1", "inv2"],
      playerIdentities: { inv1: "u1", inv2: "u2" },
    });
    await adapter.setChallenge({
      id: "c1",
      name: "psi",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["inv1", "inv2"],
      instance: op,
    });

    // Fresh adapter = no live operators, simulates restart
    const adapter2 = new SqlArenaStorageAdapter(db);
    const c = await adapter2.getChallenge("c1");
    assert.ok(c);

    // State is reconstructed from DB
    assert.equal(c.instance.state.gameStarted, true);
    assert.equal(c.instance.state.gameEnded, true);
    assert.equal(c.instance.state.completedAt, 2000);
    assert.equal(c.instance.state.scores.length, 2);
    assert.deepEqual(c.instance.state.playerIdentities, {
      inv1: "u1",
      inv2: "u2",
    });

    // join/message should throw on read-only stub
    await assert.rejects(
      () => c.instance.join("inv1"),
      /completed challenge/
    );
    await assert.rejects(
      () => c.instance.message({ channel: "c1", from: "x", content: "", timestamp: 0 }),
      /completed challenge/
    );
  });

  it("read-only stub lists and finds by invite after restart", async () => {
    await adapter.setChallenge({
      id: "c1",
      name: "psi",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["inv1"],
      instance: mockOperator({
        gameEnded: true,
        players: ["inv1"],
        playerIdentities: { inv1: "alice" },
      }),
    });

    const adapter2 = new SqlArenaStorageAdapter(db);
    const list = await adapter2.listChallenges();
    assert.equal(list.length, 1);

    const byInvite = await adapter2.getChallengeFromInvite("inv1");
    assert.ok(byInvite);
    assert.equal(byInvite.id, "c1");

    const byUser = await adapter2.getChallengesByUserId("alice");
    assert.equal(byUser.length, 1);
  });

  it("clearRuntimeState empties everything", async () => {
    await adapter.setChallenge({
      id: "c1",
      name: "psi",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["i1"],
      instance: mockOperator(),
    });
    await adapter.clearRuntimeState();
    assert.equal((await adapter.listChallenges()).length, 0);
    assert.equal(await adapter.getChallengeFromInvite("i1"), undefined);
  });
});
