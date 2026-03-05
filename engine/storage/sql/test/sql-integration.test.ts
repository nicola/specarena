import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Kysely, Migrator, SqliteDialect } from "kysely";
import Database from "better-sqlite3";
import type { Database as DatabaseSchema } from "../schema";
import { StaticMigrationProvider } from "../migrations";
import { SqlArenaStorageAdapter } from "../SqlArenaStorageAdapter";
import { SqlChatStorageAdapter } from "../SqlChatStorageAdapter";
import { SqlUserStorageAdapter } from "../SqlUserStorageAdapter";
import { SqlScoringStorageAdapter } from "../SqlScoringStorageAdapter";
import { ArenaEngine, createEngine } from "../../../engine";
import { createChatEngine } from "../../../chat/ChatEngine";
import { ScoringModule } from "../../../scoring/index";
import type { ScoringEntry, EngineConfig } from "../../../scoring/types";
import { strategies, globalStrategies } from "../../../../scoring";

function createTestDb() {
  const sqliteDb = new Database(":memory:");
  sqliteDb.pragma("foreign_keys = ON");
  return new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({ database: sqliteDb }),
  });
}

async function migrate(db: Kysely<DatabaseSchema>) {
  const migrator = new Migrator({
    db,
    provider: new StaticMigrationProvider(),
  });
  const { error } = await migrator.migrateToLatest();
  if (error) throw error;
}

const testConfig: EngineConfig = {
  challenges: [{ name: "psi", scoring: ["win-rate"] }],
  scoring: {
    default: ["average"],
    global: "global-average",
  },
};

describe("SQL adapters wired through ArenaEngine", () => {
  let db: Kysely<DatabaseSchema>;
  let engine: ArenaEngine;
  let scoring: ScoringModule;

  beforeEach(async () => {
    db = createTestDb();
    await migrate(db);

    const arenaAdapter = new SqlArenaStorageAdapter(db);
    const chatAdapter = new SqlChatStorageAdapter(db);
    const userAdapter = new SqlUserStorageAdapter(db);
    const scoringAdapter = new SqlScoringStorageAdapter(db);

    const chatEngine = createChatEngine({ storageAdapter: chatAdapter });
    scoring = new ScoringModule(
      testConfig,
      strategies,
      globalStrategies,
      scoringAdapter
    );

    engine = createEngine({
      storageAdapter: arenaAdapter,
      chatEngine,
      scoring,
      userStorage: userAdapter,
    });
  });

  it("user storage round-trips through engine", async () => {
    const user = await engine.users.setUser("u1", {
      username: "alice",
      model: "gpt-4",
    });
    assert.equal(user.username, "alice");

    const fetched = await engine.users.getUser("u1");
    assert.ok(fetched);
    assert.equal(fetched.username, "alice");
    assert.equal(fetched.model, "gpt-4");
  });

  it("chat messages persist through SQL adapter", async () => {
    await engine.chat.chatSend("lobby", "alice", "Hello!");
    await engine.chat.chatSend("lobby", "bob", "Hi there!");

    const sync = await engine.chat.chatSync("lobby", "alice", 0);
    assert.equal(sync.count, 2);
    assert.equal(sync.messages[0].from, "alice");
    assert.equal(sync.messages[0].content, "Hello!");
    assert.equal(sync.messages[1].from, "bob");
  });

  it("chat DMs are redacted for non-participants", async () => {
    await engine.chat.chatSend("lobby", "alice", "public msg");
    await engine.chat.chatSend("lobby", "alice", "secret", "bob");

    // Eve can see public but not the DM content
    const sync = await engine.chat.chatSync("lobby", "eve", 0);
    assert.equal(sync.count, 2);
    const dm = sync.messages.find((m) => m.to === "bob");
    assert.ok(dm);
    assert.equal(dm.redacted, true);
    assert.equal(dm.content, "");
  });

  it("chat index tracking works with SQL", async () => {
    await engine.chat.chatSend("ch", "a", "msg1");
    await engine.chat.chatSend("ch", "a", "msg2");
    await engine.chat.chatSend("ch", "a", "msg3");

    // Sync from index 3 — only get message 3
    const sync = await engine.chat.chatSync("ch", "a", 3);
    assert.equal(sync.count, 1);
    assert.equal(sync.messages[0].content, "msg3");
  });

  it("channel deletion clears SQL data", async () => {
    await engine.chat.chatSend("ch", "a", "msg1");
    await engine.chat.deleteChannel("ch");

    const sync = await engine.chat.chatSync("ch", null, 0);
    assert.equal(sync.count, 0);
  });

  it("scoring recordGame + getScoring with SQL backend", async () => {
    await scoring.recordGame({
      gameId: "g1",
      challengeType: "psi",
      createdAt: Date.now(),
      completedAt: Date.now(),
      scores: [
        { security: 1, utility: 0.8 },
        { security: 0.5, utility: 1 },
      ],
      players: ["inv_a", "inv_b"],
      playerIdentities: { inv_a: "alice", inv_b: "bob" },
    });

    await scoring.waitForIdle();

    const scores = await scoring.getScoring("psi");
    assert.ok(scores["average"]);
    assert.ok(scores["win-rate"]);

    const alice = scores["average"].find(
      (e: ScoringEntry) => e.playerId === "alice"
    );
    assert.ok(alice);
    assert.equal(alice.metrics["games_played:count"], 1);
    assert.equal(alice.metrics["average:security"], 1);
    assert.equal(alice.metrics["average:utility"], 0.8);
  });

  it("scoring accumulates multiple games with SQL backend", async () => {
    for (let i = 0; i < 3; i++) {
      await scoring.recordGame({
        gameId: `g${i}`,
        challengeType: "psi",
        createdAt: Date.now(),
        completedAt: Date.now(),
        scores: [
          { security: 1, utility: 1 },
          { security: 0, utility: 0 },
        ],
        players: [`inv_a${i}`, `inv_b${i}`],
        playerIdentities: {
          [`inv_a${i}`]: "alice",
          [`inv_b${i}`]: "bob",
        },
      });
    }

    await scoring.waitForIdle();

    const scores = await scoring.getScoring("psi");
    const alice = scores["average"].find(
      (e: ScoringEntry) => e.playerId === "alice"
    );
    assert.ok(alice);
    assert.equal(alice.metrics["games_played:count"], 3);
    assert.equal(alice.metrics["average:security"], 1);
    assert.equal(alice.metrics["average:utility"], 1);
  });

  it("global scoring works with SQL backend", async () => {
    await scoring.recordGame({
      gameId: "g1",
      challengeType: "psi",
      createdAt: Date.now(),
      completedAt: Date.now(),
      scores: [
        { security: 1, utility: 0.6 },
        { security: 0.4, utility: 1 },
      ],
      players: ["inv_a", "inv_b"],
      playerIdentities: { inv_a: "alice", inv_b: "bob" },
    });

    await scoring.waitForIdle();

    const global = await scoring.getGlobalScoring();
    assert.ok(global.length > 0);
    const alice = global.find(
      (e: ScoringEntry) => e.playerId === "alice"
    );
    assert.ok(alice);
    assert.equal(alice.metrics["games_played:count"], 1);
  });

  it("scoring recomputeAll works with SQL backend", async () => {
    // Record 2 games
    for (let i = 0; i < 2; i++) {
      await scoring.recordGame({
        gameId: `g${i}`,
        challengeType: "psi",
        createdAt: Date.now(),
        completedAt: Date.now(),
        scores: [
          { security: 1, utility: 1 },
          { security: 0, utility: 0 },
        ],
        players: [`inv_a${i}`, `inv_b${i}`],
        playerIdentities: {
          [`inv_a${i}`]: "alice",
          [`inv_b${i}`]: "bob",
        },
      });
    }
    await scoring.waitForIdle();

    // Recompute with only 1 game
    await scoring.recomputeAll([
      {
        gameId: "g0",
        challengeType: "psi",
        createdAt: Date.now(),
        completedAt: Date.now(),
        scores: [
          { security: 1, utility: 1 },
          { security: 0, utility: 0 },
        ],
        players: ["inv_a0", "inv_b0"],
        playerIdentities: { inv_a0: "alice", inv_b0: "bob" },
      },
    ]);

    const scores = await scoring.getScoring("psi");
    const alice = scores["average"].find(
      (e: ScoringEntry) => e.playerId === "alice"
    );
    assert.ok(alice);
    assert.equal(alice.metrics["games_played:count"], 1); // only 1 game after recompute
  });

  it("concurrent scoring writes don't lose updates", async () => {
    const games = 20;
    await Promise.all(
      Array.from({ length: games }, (_, i) =>
        scoring.recordGame({
          gameId: `g${i}`,
          challengeType: "psi",
          createdAt: Date.now(),
          completedAt: Date.now(),
          scores: [
            { security: 1, utility: 1 },
            { security: 0, utility: 0 },
          ],
          players: [`inv_a${i}`, `inv_b${i}`],
          playerIdentities: {
            [`inv_a${i}`]: "alice",
            [`inv_b${i}`]: "bob",
          },
        })
      )
    );

    await scoring.waitForIdle();

    const scores = await scoring.getScoring("psi");
    const alice = scores["average"].find(
      (e: ScoringEntry) => e.playerId === "alice"
    );
    assert.ok(alice);
    assert.equal(alice.metrics["games_played:count"], games);
  });

  it("getScoringForPlayer returns per-player breakdown", async () => {
    await scoring.recordGame({
      gameId: "g1",
      challengeType: "psi",
      createdAt: Date.now(),
      completedAt: Date.now(),
      scores: [
        { security: 1, utility: 0.8 },
        { security: 0.5, utility: 1 },
      ],
      players: ["inv_a", "inv_b"],
      playerIdentities: { inv_a: "alice", inv_b: "bob" },
    });

    await scoring.waitForIdle();

    const playerScores = await scoring.getScoringForPlayer("alice");
    assert.ok(playerScores.global);
    assert.equal(playerScores.global.playerId, "alice");
    assert.ok(playerScores.challenges.psi);
    assert.ok(playerScores.challenges.psi["average"]);
  });

  it("self-play games are skipped by scoring", async () => {
    await scoring.recordGame({
      gameId: "self",
      challengeType: "psi",
      createdAt: Date.now(),
      completedAt: Date.now(),
      scores: [
        { security: 1, utility: 1 },
        { security: 0, utility: 0 },
      ],
      players: ["inv_a", "inv_b"],
      playerIdentities: { inv_a: "alice", inv_b: "alice" },
    });

    await scoring.waitForIdle();

    const scores = await scoring.getScoring("psi");
    assert.deepEqual(scores, {});
  });
});

describe("SQL adapter simulates server restart", () => {
  it("completed challenge state survives adapter recreation", async () => {
    const db = createTestDb();
    await migrate(db);

    // First "server lifetime" — create and complete a challenge
    const adapter1 = new SqlArenaStorageAdapter(db);
    const chatAdapter1 = new SqlChatStorageAdapter(db);
    const userAdapter1 = new SqlUserStorageAdapter(db);

    await userAdapter1.setUser("alice", { username: "Alice" });
    await userAdapter1.setUser("bob", { username: "Bob" });

    // Store a completed challenge
    await adapter1.setChallenge({
      id: "c1",
      name: "psi",
      createdAt: 1000,
      challengeType: "psi",
      invites: ["inv1", "inv2"],
      instance: {
        state: {
          gameStarted: true,
          gameEnded: true,
          completedAt: 5000,
          scores: [
            { security: 1, utility: 0.8 },
            { security: 0.5, utility: 1 },
          ],
          players: ["inv1", "inv2"],
          playerIdentities: { inv1: "alice", inv2: "bob" },
          attributions: [{ from: 1, to: 0, type: "security_breach" }],
        },
        async join() {},
        async message() {},
      },
    });

    // Store chat messages
    await chatAdapter1.appendMessage("challenge_c1", {
      channel: "challenge_c1",
      from: "operator",
      to: "inv1",
      content: "Your private set is: {100, 200, 300}.",
      index: 1,
      timestamp: 2000,
    });
    await chatAdapter1.appendMessage("challenge_c1", {
      channel: "challenge_c1",
      from: "operator",
      content: "Game ended! Scores are: ...",
      index: 2,
      timestamp: 5000,
    });

    // === "Restart" — new adapters, same DB ===

    const adapter2 = new SqlArenaStorageAdapter(db);
    const chatAdapter2 = new SqlChatStorageAdapter(db);
    const userAdapter2 = new SqlUserStorageAdapter(db);

    // Challenge data survived
    const challenge = await adapter2.getChallenge("c1");
    assert.ok(challenge);
    assert.equal(challenge.instance.state.gameEnded, true);
    assert.equal(challenge.instance.state.completedAt, 5000);
    assert.equal(challenge.instance.state.scores.length, 2);
    assert.equal(challenge.instance.state.scores[0].security, 1);
    assert.deepEqual(challenge.instance.state.playerIdentities, {
      inv1: "alice",
      inv2: "bob",
    });
    assert.equal(challenge.instance.state.attributions!.length, 1);

    // Read-only stub
    await assert.rejects(() => challenge.instance.join("inv1"));

    // Lookups work
    const byInvite = await adapter2.getChallengeFromInvite("inv2");
    assert.ok(byInvite);
    assert.equal(byInvite.id, "c1");

    const byUser = await adapter2.getChallengesByUserId("bob");
    assert.equal(byUser.length, 1);

    // Chat data survived
    const msgs = await chatAdapter2.getMessagesForChannel("challenge_c1");
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].to, "inv1");
    assert.ok(msgs[0].content.includes("private set"));

    // User data survived
    const alice = await userAdapter2.getUser("alice");
    assert.ok(alice);
    assert.equal(alice.username, "Alice");
  });

  it("scoring data survives adapter recreation", async () => {
    const db = createTestDb();
    await migrate(db);

    // First lifetime: record scores
    const scoringAdapter1 = new SqlScoringStorageAdapter(db);
    const scoring1 = new ScoringModule(
      testConfig,
      strategies,
      globalStrategies,
      scoringAdapter1
    );

    await scoring1.recordGame({
      gameId: "g1",
      challengeType: "psi",
      createdAt: Date.now(),
      completedAt: Date.now(),
      scores: [
        { security: 1, utility: 0.8 },
        { security: 0.5, utility: 1 },
      ],
      players: ["inv_a", "inv_b"],
      playerIdentities: { inv_a: "alice", inv_b: "bob" },
    });
    await scoring1.waitForIdle();

    // === "Restart" ===
    const scoringAdapter2 = new SqlScoringStorageAdapter(db);
    const scoring2 = new ScoringModule(
      testConfig,
      strategies,
      globalStrategies,
      scoringAdapter2
    );

    // Scores survived
    const scores = await scoring2.getScoring("psi");
    assert.ok(scores["average"]);
    const alice = scores["average"].find(
      (e: ScoringEntry) => e.playerId === "alice"
    );
    assert.ok(alice);
    assert.equal(alice.metrics["games_played:count"], 1);
    assert.equal(alice.metrics["average:security"], 1);

    // Global survived
    const global = await scoring2.getGlobalScoring();
    assert.ok(global.length > 0);

    // Can continue recording
    await scoring2.recordGame({
      gameId: "g2",
      challengeType: "psi",
      createdAt: Date.now(),
      completedAt: Date.now(),
      scores: [
        { security: 0, utility: 0 },
        { security: 1, utility: 1 },
      ],
      players: ["inv_c", "inv_d"],
      playerIdentities: { inv_c: "alice", inv_d: "bob" },
    });
    await scoring2.waitForIdle();

    const updated = await scoring2.getScoring("psi");
    const aliceUpdated = updated["average"].find(
      (e: ScoringEntry) => e.playerId === "alice"
    );
    assert.ok(aliceUpdated);
    assert.equal(aliceUpdated.metrics["games_played:count"], 2);
    assert.equal(aliceUpdated.metrics["average:security"], 0.5); // (1 + 0) / 2
  });
});
