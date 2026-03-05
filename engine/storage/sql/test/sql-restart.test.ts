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
import { createChallenge as psiFactory } from "../../../../challenges/psi/index";
import { fromChallengeChannel } from "../../../types";
import type { ChallengeMetadata } from "../../../types";

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

const PSI_METADATA: ChallengeMetadata = {
  name: "Private Set Intersection",
  description: "Find the intersection",
  players: 2,
  prompt: "PSI",
  methods: [{ name: "guess", description: "Submit guess" }],
};

/**
 * Build a fully-wired ArenaEngine backed by the given Kysely DB.
 * Sets up the onChallengeEvent callback so scoring fires automatically
 * when a game ends, matching the real production wiring.
 */
function createSqlEngine(db: Kysely<DatabaseSchema>) {
  const arenaAdapter = new SqlArenaStorageAdapter(db);
  const chatAdapter = new SqlChatStorageAdapter(db);
  const userAdapter = new SqlUserStorageAdapter(db);
  const scoringAdapter = new SqlScoringStorageAdapter(db);

  const scoring = new ScoringModule(
    testConfig,
    strategies,
    globalStrategies,
    scoringAdapter,
  );

  // Circular ref: chatEngine callbacks need engine, engine needs chatEngine.
  // Safe because callbacks are async and only invoked after engine exists.
  let engine!: ArenaEngine;

  const chatEngine = createChatEngine({
    storageAdapter: chatAdapter,
    isChannelRevealed: async (channel) => {
      const challengeId = fromChallengeChannel(channel);
      if (!challengeId) return false;
      const challenge = await engine.getChallenge(challengeId);
      return challenge?.instance?.state?.gameEnded ?? false;
    },
  });

  engine = createEngine({
    storageAdapter: arenaAdapter,
    chatEngine,
    scoring,
    userStorage: userAdapter,
  });

  engine.registerChallengeFactory("psi", psiFactory);
  engine.registerChallengeMetadata("psi", PSI_METADATA);

  return { engine, scoring };
}

function parseSet(content: string): Set<number> {
  const match = content.match(/\{(.+)\}/);
  if (!match) return new Set();
  return new Set(match[1].split(",").map((s) => parseInt(s.trim(), 10)));
}

/**
 * Play a full PSI game to completion. If scoring is provided, records the
 * game result explicitly (the engine's async onChallengeEvent callback fires
 * without being awaited, which creates a race with waitForIdle in tests).
 */
async function playFullGame(engine: ArenaEngine, scoring?: ScoringModule) {
  const challenge = await engine.createChallenge("psi");
  const [inv1, inv2] = challenge.invites;

  await engine.challengeJoin(inv1, "alice");
  await engine.challengeJoin(inv2, "bob");
  assert.equal(challenge.instance.state.gameStarted, true);

  const sync1 = await engine.challengeSync(challenge.id, inv1, 0);
  const sync2 = await engine.challengeSync(challenge.id, inv2, 0);

  const p1Msg = sync1.messages.find(
    (m) => m.to === inv1 && m.content.includes("Your private set"),
  );
  const p2Msg = sync2.messages.find(
    (m) => m.to === inv2 && m.content.includes("Your private set"),
  );
  assert.ok(p1Msg, "player 1 should receive their set");
  assert.ok(p2Msg, "player 2 should receive their set");

  const p1Set = parseSet(p1Msg!.content);
  const p2Set = parseSet(p2Msg!.content);
  const intersection = [...p1Set].filter((n) => p2Set.has(n));
  assert.ok(intersection.length > 0, "sets should intersect");

  const guess = intersection.join(", ");
  await engine.challengeMessage(challenge.id, inv1, "guess", guess);
  await engine.challengeMessage(challenge.id, inv2, "guess", guess);
  assert.equal(challenge.instance.state.gameEnded, true);

  if (scoring) {
    const result = ScoringModule.challengeToGameResult(challenge);
    if (result) await scoring.recordGame(result);
  }

  return challenge;
}

// ─────────────────────────────────────────────────────────────────
describe("Engine restart mid-game with SQL storage", () => {
  let db: Kysely<DatabaseSchema>;

  beforeEach(async () => {
    db = createTestDb();
    await migrate(db);
  });

  // ── Mid-game scenarios ──────────────────────────────────────

  it("mid-game challenge is listed after restart but operator is a read-only stub", async () => {
    const { engine: e1 } = createSqlEngine(db);
    const challenge = await e1.createChallenge("psi");
    const [inv1, inv2] = challenge.invites;

    await e1.challengeJoin(inv1, "alice");
    await e1.challengeJoin(inv2, "bob");
    assert.equal(challenge.instance.state.gameStarted, true);

    // === Restart ===
    const { engine: e2 } = createSqlEngine(db);

    // Challenge is listed
    const list = await e2.listChallenges();
    assert.equal(list.length, 1);
    assert.equal(list[0].id, challenge.id);
    assert.equal(list[0].challengeType, "psi");

    // But the live operator is gone → read-only stub
    const restored = await e2.getChallenge(challenge.id);
    assert.ok(restored);
    await assert.rejects(
      () => restored!.instance.join(inv1),
      /completed challenge/,
    );
    await assert.rejects(
      () => restored!.instance.message({
        channel: challenge.id,
        from: inv1,
        type: "guess",
        content: "1, 2, 3",
        timestamp: Date.now(),
      }),
      /completed challenge/,
    );
  });

  it("mid-game with one player joined — join state is lost after restart", async () => {
    const { engine: e1 } = createSqlEngine(db);
    const challenge = await e1.createChallenge("psi");
    const [inv1] = challenge.invites;

    // Only one player joins
    await e1.challengeJoin(inv1, "alice");
    assert.equal(challenge.instance.state.players.length, 1);
    assert.equal(challenge.instance.state.gameStarted, false);

    // === Restart ===
    const { engine: e2 } = createSqlEngine(db);

    const restored = await e2.getChallenge(challenge.id);
    assert.ok(restored);

    // setChallenge was only called at creation (before any joins),
    // so the DB has no record of alice joining
    assert.equal(restored!.instance.state.players.length, 0);
    assert.equal(restored!.instance.state.gameStarted, false);
    assert.deepEqual(restored!.instance.state.playerIdentities, {});
  });

  it("invite lookup still works after restart for mid-game challenge", async () => {
    const { engine: e1 } = createSqlEngine(db);
    const challenge = await e1.createChallenge("psi");
    const [inv1, inv2] = challenge.invites;

    await e1.challengeJoin(inv1, "alice");

    // === Restart ===
    const { engine: e2 } = createSqlEngine(db);

    // Both invites still resolve to the challenge
    const result1 = await e2.getChallengeFromInvite(inv1);
    assert.ok(result1.success);
    assert.equal(result1.success && result1.data.id, challenge.id);

    const result2 = await e2.getChallengeFromInvite(inv2);
    assert.ok(result2.success);
  });

  it("stale GC cleans up stuck mid-game challenges after restart", async () => {
    const { engine: e1 } = createSqlEngine(db);
    const challenge = await e1.createChallenge("psi");
    const [inv1, inv2] = challenge.invites;

    await e1.challengeJoin(inv1, "alice");
    await e1.challengeJoin(inv2, "bob");

    // Backdate the challenge to make it stale (>10 min old)
    await db
      .updateTable("challenges")
      .set({ created_at: Date.now() - 20 * 60 * 1000 })
      .where("id", "=", challenge.id)
      .execute();

    // === Restart ===
    const { engine: e2 } = createSqlEngine(db);

    // listChallenges returns it (doesn't filter stale)
    assert.equal((await e2.listChallenges()).length, 1);

    // getChallenge triggers lazy stale deletion
    const stale = await e2.getChallenge(challenge.id);
    assert.equal(stale, undefined);

    // Now it's gone
    assert.equal((await e2.listChallenges()).length, 0);
  });

  it("pruneStaleChallenges bulk-cleans stuck mid-game challenges after restart", async () => {
    const { engine: e1 } = createSqlEngine(db);

    // Create 3 challenges, backdate 2 of them
    const c1 = await e1.createChallenge("psi");
    const c2 = await e1.createChallenge("psi");
    const c3 = await e1.createChallenge("psi");

    const oldTime = Date.now() - 20 * 60 * 1000;
    await db
      .updateTable("challenges")
      .set({ created_at: oldTime })
      .where("id", "in", [c1.id, c2.id])
      .execute();

    // === Restart ===
    const { engine: e2 } = createSqlEngine(db);

    const pruned = await e2.pruneStaleChallenges();
    assert.equal(pruned, 2);
    assert.equal((await e2.listChallenges()).length, 1);

    // Surviving challenge is c3
    const remaining = await e2.getChallenge(c3.id);
    assert.ok(remaining);
  });

  // ── Chat persistence across restart ─────────────────────────

  it("chat messages from mid-game survive restart", async () => {
    const { engine: e1 } = createSqlEngine(db);
    const challenge = await e1.createChallenge("psi");
    const [inv1, inv2] = challenge.invites;

    await e1.challengeJoin(inv1, "alice");
    await e1.challengeJoin(inv2, "bob");

    // Get message count from the challenge channel
    const sync1 = await e1.challengeSync(challenge.id, inv1, 0);
    const msgCount = sync1.count;
    assert.ok(msgCount > 0, "operator should have sent private set messages");

    // === Restart ===
    const { engine: e2 } = createSqlEngine(db);

    // All challenge channel messages survived
    const sync2 = await e2.challengeSync(challenge.id, inv1, 0);
    assert.equal(sync2.count, msgCount);

    // The private set message is visible to inv1
    const setMsg = sync2.messages.find(
      (m) => m.to === inv1 && m.content.includes("Your private set"),
    );
    assert.ok(setMsg, "private set message should survive restart");
  });

  it("DM redaction still works after restart", async () => {
    const { engine: e1 } = createSqlEngine(db);
    const challenge = await e1.createChallenge("psi");
    const [inv1, inv2] = challenge.invites;

    await e1.challengeJoin(inv1, "alice");
    await e1.challengeJoin(inv2, "bob");

    // === Restart ===
    const { engine: e2 } = createSqlEngine(db);

    // inv1 sees their own DMs in full
    const syncOwner = await e2.challengeSync(challenge.id, inv1, 0);
    const ownDm = syncOwner.messages.find(
      (m) => m.to === inv1 && m.content.includes("Your private set"),
    );
    assert.ok(ownDm);
    assert.ok(!ownDm!.redacted);

    // inv2 cannot see inv1's DMs
    const syncOther = await e2.challengeSync(challenge.id, inv2, 0);
    const redacted = syncOther.messages.filter((m) => m.redacted);
    const inv1Dms = syncOwner.messages.filter((m) => m.to === inv1);
    assert.equal(redacted.length, inv1Dms.length);
    for (const msg of redacted) {
      assert.equal(msg.content, "");
    }
  });

  it("chat index continuity — new messages get correct indices after restart", async () => {
    const { engine: e1 } = createSqlEngine(db);
    await e1.chat.chatSend("lobby", "alice", "msg1");
    await e1.chat.chatSend("lobby", "alice", "msg2");

    // === Restart ===
    const { engine: e2 } = createSqlEngine(db);

    // Old messages survive
    const sync = await e2.chat.chatSync("lobby", null, 0);
    assert.equal(sync.count, 2);

    // New message gets the next sequential index (3), not 1
    const sent = await e2.chat.chatSend("lobby", "bob", "msg3");
    assert.equal(sent.index, 3);

    const syncAfter = await e2.chat.chatSync("lobby", null, 0);
    assert.equal(syncAfter.count, 3);
    assert.equal(syncAfter.messages[2].content, "msg3");
    assert.equal(syncAfter.messages[2].index, 3);
  });

  // ── Scoring persistence across restart ──────────────────────

  it("scoring survives restart after completed game", async () => {
    const { engine: e1, scoring: s1 } = createSqlEngine(db);
    await playFullGame(e1, s1);
    await s1.waitForIdle();

    const scoresBefore = await s1.getScoring("psi");
    const aliceBefore = scoresBefore["average"]?.find(
      (e: ScoringEntry) => e.playerId === "alice",
    );
    assert.ok(aliceBefore);
    assert.equal(aliceBefore.gamesPlayed, 1);

    // === Restart ===
    const { scoring: s2 } = createSqlEngine(db);

    const scoresAfter = await s2.getScoring("psi");
    const aliceAfter = scoresAfter["average"]?.find(
      (e: ScoringEntry) => e.playerId === "alice",
    );
    assert.ok(aliceAfter);
    assert.equal(aliceAfter.gamesPlayed, 1);
    assert.equal(
      aliceAfter.metrics["average:security"],
      aliceBefore.metrics["average:security"],
    );
    assert.equal(
      aliceAfter.metrics["average:utility"],
      aliceBefore.metrics["average:utility"],
    );

    // Global scores survived too
    const global = await s2.getGlobalScoring();
    const aliceGlobal = global.find(
      (e: ScoringEntry) => e.playerId === "alice",
    );
    assert.ok(aliceGlobal);
    assert.equal(aliceGlobal.gamesPlayed, 1);
  });

  it("scoring accumulates across restarts", async () => {
    // Lifetime 1: play game 1
    const { engine: e1, scoring: s1 } = createSqlEngine(db);
    await playFullGame(e1, s1);
    await s1.waitForIdle();

    // Lifetime 2: play game 2
    const { engine: e2, scoring: s2 } = createSqlEngine(db);
    await playFullGame(e2, s2);
    await s2.waitForIdle();

    // Lifetime 3: verify accumulation
    const { scoring: s3 } = createSqlEngine(db);

    const scores = await s3.getScoring("psi");
    const alice = scores["average"]?.find(
      (e: ScoringEntry) => e.playerId === "alice",
    );
    assert.ok(alice);
    assert.equal(alice.gamesPlayed, 2);

    const bob = scores["average"]?.find(
      (e: ScoringEntry) => e.playerId === "bob",
    );
    assert.ok(bob);
    assert.equal(bob.gamesPlayed, 2);

    // Global accumulated too
    const playerScores = await s3.getScoringForPlayer("alice");
    assert.ok(playerScores.global);
    assert.equal(playerScores.global.gamesPlayed, 2);
  });

  it("getScoresForPlayer works after restart", async () => {
    const { engine: e1, scoring: s1 } = createSqlEngine(db);
    await playFullGame(e1, s1);
    await s1.waitForIdle();

    // === Restart ===
    const { scoring: s2 } = createSqlEngine(db);

    const playerScores = await s2.getScoringForPlayer("alice");
    assert.ok(playerScores.global);
    assert.equal(playerScores.global.playerId, "alice");
    assert.ok(playerScores.challenges.psi);
    assert.ok(playerScores.challenges.psi["average"]);
    assert.equal(playerScores.challenges.psi["average"].gamesPlayed, 1);
  });

  // ── User persistence across restart ─────────────────────────

  it("user profiles survive restart", async () => {
    const { engine: e1 } = createSqlEngine(db);
    await e1.users.setUser("alice", { username: "Alice", model: "gpt-4" });
    await e1.users.setUser("bob", { username: "Bob" });

    // === Restart ===
    const { engine: e2 } = createSqlEngine(db);

    const alice = await e2.users.getUser("alice");
    assert.ok(alice);
    assert.equal(alice.username, "Alice");
    assert.equal(alice.model, "gpt-4");

    const bob = await e2.users.getUser("bob");
    assert.ok(bob);
    assert.equal(bob.username, "Bob");
  });

  // ── New challenges after restart ────────────────────────────

  it("new challenges work after restart alongside old data", async () => {
    const { engine: e1 } = createSqlEngine(db);
    const c1 = await e1.createChallenge("psi");
    await e1.challengeJoin(c1.invites[0], "alice");

    // === Restart ===
    const { engine: e2 } = createSqlEngine(db);

    // Old challenge is listed
    assert.equal((await e2.listChallenges()).length, 1);

    // New challenge works normally
    const c2 = await e2.createChallenge("psi");
    assert.equal((await e2.listChallenges()).length, 2);

    const [inv1, inv2] = c2.invites;
    const join1 = await e2.challengeJoin(inv1, "carol");
    assert.ok(join1.ChallengeID);
    const join2 = await e2.challengeJoin(inv2, "dave");
    assert.ok(join2.ChallengeID);
    assert.equal(c2.instance.state.gameStarted, true);
  });

  it("completed game after restart can coexist with stuck mid-game challenge", async () => {
    // Lifetime 1: create challenge but don't finish
    const { engine: e1 } = createSqlEngine(db);
    const stuck = await e1.createChallenge("psi");
    await e1.challengeJoin(stuck.invites[0], "alice");
    await e1.challengeJoin(stuck.invites[1], "bob");

    // === Restart ===
    const { engine: e2, scoring: s2 } = createSqlEngine(db);

    // Play a new complete game
    await playFullGame(e2, s2);
    await s2.waitForIdle();

    // Both challenges are listed
    const list = await e2.listChallenges();
    assert.equal(list.length, 2);

    // Scoring only reflects the completed game
    const scores = await s2.getScoring("psi");
    const alice = scores["average"]?.find(
      (e: ScoringEntry) => e.playerId === "alice",
    );
    assert.ok(alice);
    assert.equal(alice.gamesPlayed, 1);
  });

  // ── Multiple restarts ───────────────────────────────────────

  it("three lifetimes accumulate users, scores, and chat correctly", async () => {
    // Lifetime 1
    const { engine: e1, scoring: s1 } = createSqlEngine(db);
    await e1.users.setUser("alice", { username: "Alice" });
    await e1.chat.chatSend("lobby", "alice", "hello from lifetime 1");
    await playFullGame(e1, s1);
    await s1.waitForIdle();

    // Lifetime 2
    const { engine: e2, scoring: s2 } = createSqlEngine(db);
    await e2.chat.chatSend("lobby", "bob", "hello from lifetime 2");
    await playFullGame(e2, s2);
    await s2.waitForIdle();

    // Lifetime 3: verify everything
    const { engine: e3, scoring: s3 } = createSqlEngine(db);
    await e3.chat.chatSend("lobby", "carol", "hello from lifetime 3");

    // User from lifetime 1 survived
    const alice = await e3.users.getUser("alice");
    assert.ok(alice);
    assert.equal(alice.username, "Alice");

    // Lobby has 3 messages from 3 lifetimes
    const lobby = await e3.chat.chatSync("lobby", null, 0);
    assert.equal(lobby.count, 3);
    assert.equal(lobby.messages[0].content, "hello from lifetime 1");
    assert.equal(lobby.messages[1].content, "hello from lifetime 2");
    assert.equal(lobby.messages[2].content, "hello from lifetime 3");
    // Indices are sequential across all lifetimes
    assert.equal(lobby.messages[0].index, 1);
    assert.equal(lobby.messages[1].index, 2);
    assert.equal(lobby.messages[2].index, 3);

    // 2 completed challenges + their scores
    const scores = await s3.getScoring("psi");
    const aliceScore = scores["average"]?.find(
      (e: ScoringEntry) => e.playerId === "alice",
    );
    assert.ok(aliceScore);
    assert.equal(aliceScore.gamesPlayed, 2);

    // Global scores accumulated
    const global = await s3.getGlobalScoring();
    assert.ok(global.find((e: ScoringEntry) => e.playerId === "alice"));
    assert.ok(global.find((e: ScoringEntry) => e.playerId === "bob"));
  });
});
