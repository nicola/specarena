import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ScoringModule } from "../scoring/index";
import type { GameResult, EngineConfig, ScoringEntry } from "../scoring/types";
import { strategies, globalStrategies } from "@arena/scoring";
import app from "../server/index";
import { defaultEngine } from "../engine";

// --- Helpers ---

const testConfig: EngineConfig = {
  challenges: [
    { name: "psi", scoring: ["win-rate"] },
    { name: "other-challenge" },
  ],
  scoring: {
    default: ["average"],
    global: "global-average",
  },
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

// --- Unit Tests ---

describe("ScoringModule", () => {
  let scoring: ScoringModule;

  beforeEach(() => {
    scoring = new ScoringModule(testConfig, strategies, globalStrategies);
  });

  it("records a game and produces per-challenge scores", async () => {
    await scoring.recordGame(makeGameResult());
    const scores = await scoring.getScoring("psi");

    assert.ok(scores["average"], "should have average strategy");
    assert.ok(scores["win-rate"], "should have win-rate strategy");

    // Average strategy: 1 game each, scores should equal the game scores
    const avg = scores["average"];
    const alice = avg.find((e: ScoringEntry) => e.playerId === "user-alice");
    const bob = avg.find((e: ScoringEntry) => e.playerId === "user-bob");

    assert.ok(alice);
    assert.equal(alice.gamesPlayed, 1);
    assert.equal(alice.security, 1);
    assert.equal(alice.utility, 0.8);

    assert.ok(bob);
    assert.equal(bob.gamesPlayed, 1);
    assert.equal(bob.security, 0.5);
    assert.equal(bob.utility, 1);
  });

  it("computes win-rate correctly for 2-player games", async () => {
    await scoring.recordGame(makeGameResult());
    const scores = await scoring.getScoring("psi");
    const wr = scores["win-rate"];

    const alice = wr.find((e: ScoringEntry) => e.playerId === "user-alice");
    const bob = wr.find((e: ScoringEntry) => e.playerId === "user-bob");

    assert.ok(alice);
    assert.ok(bob);
    // Alice: security=1 > 0.5 (win), utility=0.8 < 1 (loss)
    assert.equal(alice.security, 1);
    assert.equal(alice.utility, 0);
    // Bob: security loss, utility win
    assert.equal(bob.security, 0);
    assert.equal(bob.utility, 1);
  });

  it("handles ties in win-rate as 0.5", async () => {
    const game = makeGameResult({
      scores: [
        { security: 0.5, utility: 0.5 },
        { security: 0.5, utility: 0.5 },
      ],
    });
    await scoring.recordGame(game);
    const wr = (await scoring.getScoring("psi"))["win-rate"];

    const alice = wr.find((e: ScoringEntry) => e.playerId === "user-alice");
    assert.ok(alice);
    assert.equal(alice.security, 0.5);
    assert.equal(alice.utility, 0.5);
  });

  it("averages across multiple games", async () => {
    await scoring.recordGame(makeGameResult({
      gameId: "game-1",
      scores: [
        { security: 1, utility: 1 },
        { security: 0, utility: 0 },
      ],
    }));
    await scoring.recordGame(makeGameResult({
      gameId: "game-2",
      scores: [
        { security: 0, utility: 0 },
        { security: 1, utility: 1 },
      ],
    }));

    const avg = (await scoring.getScoring("psi"))["average"];
    const alice = avg.find((e: ScoringEntry) => e.playerId === "user-alice");
    const bob = avg.find((e: ScoringEntry) => e.playerId === "user-bob");

    assert.ok(alice);
    assert.equal(alice.gamesPlayed, 2);
    assert.equal(alice.security, 0.5);
    assert.equal(alice.utility, 0.5);

    assert.ok(bob);
    assert.equal(bob.gamesPlayed, 2);
    assert.equal(bob.security, 0.5);
    assert.equal(bob.utility, 0.5);
  });

  it("produces global scores", async () => {
    await scoring.recordGame(makeGameResult());
    const global = await scoring.getGlobalScoring();

    assert.ok(global.length > 0, "should have global scores");
    const alice = global.find((e: ScoringEntry) => e.playerId === "user-alice");
    assert.ok(alice);
    assert.equal(alice.gamesPlayed, 1);
  });

  it("global-average aggregates across challenge types", async () => {
    await scoring.recordGame(makeGameResult({ challengeType: "psi" }));
    await scoring.recordGame(makeGameResult({
      challengeType: "other-challenge",
      gameId: "game-2",
      scores: [
        { security: 0, utility: 0 },
        { security: 1, utility: 1 },
      ],
    }));

    const global = await scoring.getGlobalScoring();
    const alice = global.find((e: ScoringEntry) => e.playerId === "user-alice");
    assert.ok(alice);
    // psi: security=1, utility=0.8; other-challenge: security=0, utility=0
    // global average: security=0.5, utility=0.4
    assert.equal(alice.security, 0.5);
    assert.equal(alice.utility, 0.4);
    assert.equal(alice.gamesPlayed, 2);
  });

  it("recomputeAll clears and recomputes from scratch", async () => {
    await scoring.recordGame(makeGameResult());
    await scoring.recordGame(makeGameResult({ gameId: "game-extra" }));

    // Now recompute with just one game
    await scoring.recomputeAll([makeGameResult()]);
    const avg = (await scoring.getScoring("psi"))["average"];
    const alice = avg.find((e: ScoringEntry) => e.playerId === "user-alice");
    assert.ok(alice);
    assert.equal(alice.gamesPlayed, 1);
  });

  it("challenges without explicit scoring get only defaults", async () => {
    await scoring.recordGame(makeGameResult({ challengeType: "other-challenge", gameId: "game-other" }));
    const scores = await scoring.getScoring("other-challenge");
    assert.ok(scores["average"], "should have default average strategy");
    assert.ok(!scores["win-rate"], "should NOT have win-rate (not in defaults or challenge config)");
  });

  it("challengeToGameResult returns null for non-ended games", () => {
    const challenge = {
      id: "c1",
      name: "psi",
      createdAt: Date.now(),
      challengeType: "psi",
      invites: ["inv_1", "inv_2"],
      instance: {
        state: {
          gameStarted: true,
          gameEnded: false,
          scores: [],
          players: [],
          playerIdentities: {},
        },
        join: async () => {},
        message: async () => {},
      },
    };
    assert.equal(ScoringModule.challengeToGameResult(challenge), null);
  });

  it("challengeToGameResult converts ended game", () => {
    const challenge = {
      id: "c1",
      name: "psi",
      createdAt: 12345,
      challengeType: "psi",
      invites: ["inv_1", "inv_2"],
      instance: {
        state: {
          gameStarted: true,
          gameEnded: true,
          scores: [{ security: 1, utility: 1 }],
          players: ["inv_1"],
          playerIdentities: { inv_1: "user-1" },
        },
        join: async () => {},
        message: async () => {},
      },
    };
    const result = ScoringModule.challengeToGameResult(challenge);
    assert.ok(result);
    assert.equal(result.gameId, "c1");
    assert.equal(result.challengeType, "psi");
    assert.deepEqual(result.scores, [{ security: 1, utility: 1 }]);
  });

  it("same player against different opponents accumulates correctly", async () => {
    // Alice vs Bob
    await scoring.recordGame(makeGameResult({
      gameId: "game-1",
      scores: [{ security: 1, utility: 1 }, { security: 0, utility: 0 }],
      players: ["inv_a", "inv_b"],
      playerIdentities: { inv_a: "user-alice", inv_b: "user-bob" },
    }));
    // Alice vs Charlie (alice reuses different invite)
    await scoring.recordGame(makeGameResult({
      gameId: "game-2",
      scores: [{ security: 0, utility: 0 }, { security: 1, utility: 1 }],
      players: ["inv_c", "inv_d"],
      playerIdentities: { inv_c: "user-alice", inv_d: "user-charlie" },
    }));

    const avg = (await scoring.getScoring("psi"))["average"];
    const alice = avg.find((e: ScoringEntry) => e.playerId === "user-alice");
    const bob = avg.find((e: ScoringEntry) => e.playerId === "user-bob");
    const charlie = avg.find((e: ScoringEntry) => e.playerId === "user-charlie");

    assert.ok(alice);
    assert.equal(alice.gamesPlayed, 2);
    assert.equal(alice.security, 0.5);
    assert.equal(alice.utility, 0.5);

    assert.ok(bob);
    assert.equal(bob.gamesPlayed, 1);

    assert.ok(charlie);
    assert.equal(charlie.gamesPlayed, 1);
  });

  it("skips players with no identity mapping", async () => {
    await scoring.recordGame(makeGameResult({
      players: ["inv_a", "inv_b"],
      playerIdentities: { inv_a: "user-alice" }, // inv_b has no mapping
    }));

    const avg = (await scoring.getScoring("psi"))["average"];
    assert.equal(avg.length, 1, "only alice should appear");
    assert.equal(avg[0].playerId, "user-alice");
  });

  it("getScoring returns empty object for unknown challenge type", async () => {
    const scores = await scoring.getScoring("nonexistent");
    assert.deepEqual(scores, {});
  });

  it("getGlobalScoring returns empty array with no games", async () => {
    assert.deepEqual(await scoring.getGlobalScoring(), []);
  });

  it("skips self-play games where same userId is on both sides", async () => {
    await scoring.recordGame(makeGameResult({
      players: ["inv_a", "inv_b"],
      playerIdentities: { inv_a: "user-alice", inv_b: "user-alice" },
    }));
    assert.deepEqual(await scoring.getScoring("psi"), {});
    assert.deepEqual(await scoring.getGlobalScoring(), []);
  });

  it("recomputeAll also skips self-play games", async () => {
    await scoring.recomputeAll([
      makeGameResult({
        gameId: "self",
        players: ["inv_a", "inv_b"],
        playerIdentities: { inv_a: "user-alice", inv_b: "user-alice" },
      }),
      makeGameResult({
        gameId: "legit",
        players: ["inv_c", "inv_d"],
        playerIdentities: { inv_c: "user-alice", inv_d: "user-bob" },
      }),
    ]);
    const avg = (await scoring.getScoring("psi"))["average"];
    const alice = avg.find((e: ScoringEntry) => e.playerId === "user-alice");
    assert.ok(alice);
    assert.equal(alice.gamesPlayed, 1, "only the legit game should count");
  });
});

// --- Integration: scoring hook in engine ---

describe("Scoring integration via engine", () => {
  async function request(method: string, path: string, body?: object) {
    return app.request(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  beforeEach(async () => {
    await defaultEngine.clearRuntimeState();
  });

  it("game_ended event triggers scoring update", async () => {
    // Create challenge
    const createRes = await request("POST", "/api/challenges/psi");
    assert.equal(createRes.status, 200);
    const { id: challengeId, invites } = await createRes.json();

    // Join both players
    await defaultEngine.challengeJoin(invites[0], "user-alice");
    await defaultEngine.challengeJoin(invites[1], "user-bob");

    const challenge = await defaultEngine.getChallenge(challengeId);
    assert.ok(challenge);

    // Get private sets and compute intersection
    const gameState = (challenge.instance as any).gameState;
    const p1Set: Set<number> = gameState.userSets[0];
    const p2Set: Set<number> = gameState.userSets[1];
    const intersection = [...p1Set].filter((n) => p2Set.has(n));
    const guessContent = intersection.join(", ");

    // Both players guess correctly
    await defaultEngine.challengeMessage(challengeId, invites[0], "guess", guessContent);
    await defaultEngine.challengeMessage(challengeId, invites[1], "guess", guessContent);

    assert.equal(challenge.instance.state.gameEnded, true);

    // Give async scoring a tick to complete
    await new Promise((r) => setTimeout(r, 50));

    // Scoring should have been updated
    assert.ok(defaultEngine.scoring, "scoring module should exist");
    const scores = await defaultEngine.scoring!.getScoring("psi");
    assert.ok(scores["average"], "should have average scores");
    assert.ok(scores["win-rate"], "should have win-rate scores");

    const global = await defaultEngine.scoring!.getGlobalScoring();
    assert.ok(global.length > 0, "should have global scores");
  });

  it("GET /api/scoring returns global scores", async () => {
    const res = await request("GET", "/api/scoring");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data));
  });

  it("GET /api/scoring/:challengeType returns per-challenge scores", async () => {
    const res = await request("GET", "/api/scoring/psi");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(typeof data === "object");
  });

  it("GET /api/scoring/:challengeType returns 404 for unknown type", async () => {
    const res = await request("GET", "/api/scoring/nonexistent");
    assert.equal(res.status, 404);
    const data = await res.json();
    assert.equal(data.error, "Unknown challenge type");
  });

  it("multiple games accumulate and API returns correct values", async () => {
    // Play two full games
    for (let i = 0; i < 2; i++) {
      const createRes = await request("POST", "/api/challenges/psi");
      const { id: challengeId, invites } = await createRes.json();

      await defaultEngine.challengeJoin(invites[0], "user-alice");
      await defaultEngine.challengeJoin(invites[1], "user-bob");

      const challenge = await defaultEngine.getChallenge(challengeId);
      assert.ok(challenge);

      const gameState = (challenge.instance as any).gameState;
      const p1Set: Set<number> = gameState.userSets[0];
      const p2Set: Set<number> = gameState.userSets[1];
      const intersection = [...p1Set].filter((n) => p2Set.has(n));

      await defaultEngine.challengeMessage(challengeId, invites[0], "guess", intersection.join(", "));
      await defaultEngine.challengeMessage(challengeId, invites[1], "guess", intersection.join(", "));
      assert.equal(challenge.instance.state.gameEnded, true);
    }

    // Give async scoring a tick to complete
    await new Promise((r) => setTimeout(r, 50));

    // Check per-challenge scores via API
    const psiRes = await request("GET", "/api/scoring/psi");
    const psiData = await psiRes.json();
    assert.ok(psiData["average"]);
    const alice = psiData["average"].find((e: any) => e.playerId === "user-alice");
    assert.ok(alice);
    assert.ok(alice.gamesPlayed >= 2, `alice should have at least 2 games, got ${alice.gamesPlayed}`);

    // Check global scores via API
    const globalRes = await request("GET", "/api/scoring");
    const globalData = await globalRes.json();
    assert.ok(globalData.length > 0);
    const globalAlice = globalData.find((e: any) => e.playerId === "user-alice");
    assert.ok(globalAlice);
    assert.ok(globalAlice.gamesPlayed >= 2, `global alice should have at least 2 games, got ${globalAlice.gamesPlayed}`);
  });
});
