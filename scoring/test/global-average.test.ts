import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { globalAverage } from "../global-average";
import { average } from "../average";
import { InMemoryScoringStore } from "../store";
import type { GameResult } from "../types";

function makeGame(
  p0: { security: number; utility: number },
  p1: { security: number; utility: number },
  overrides?: Partial<GameResult>
): GameResult {
  return {
    gameId: crypto.randomUUID(),
    challengeType: "psi",
    createdAt: Date.now(),
    completedAt: Date.now(),
    scores: [p0, p1],
    players: ["inv_a", "inv_b"],
    playerIdentities: { inv_a: "alice", inv_b: "bob" },
    ...overrides,
  };
}

describe("global-average strategy", () => {
  let store: InMemoryScoringStore;

  beforeEach(() => {
    store = new InMemoryScoringStore();
  });

  /** Feed games through average strategy then global-average, return global entries. */
  async function computeGlobal(
    games: GameResult[],
    options?: { securityWeight?: number; utilityWeight?: number }
  ) {
    for (const game of games) {
      await average.update(game, store, options);
      await globalAverage.update(game, store, "average");
    }
    return store.getGlobalScores();
  }

  it("declares metric descriptors", () => {
    assert.deepStrictEqual(globalAverage.metrics, [
      { key: "global-average:security", label: "Security" },
      { key: "global-average:utility", label: "Utility" },
      { key: "global-average:combined", label: "Combined" },
    ]);
  });

  it("returns empty for no games", async () => {
    const entries = await computeGlobal([]);
    assert.deepStrictEqual(entries, []);
  });

  it("single challenge type — passes through as-is", async () => {
    const entries = await computeGlobal([
      makeGame({ security: 1, utility: 1 }, { security: -1, utility: -1 }),
      makeGame({ security: 1, utility: 1 }, { security: -1, utility: -1 }),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    assert.equal(alice.metrics["global-average:security"], 1);
    assert.equal(alice.metrics["global-average:utility"], 1);
    assert.equal(alice.gamesPlayed, 2);

    assert.equal(bob.metrics["global-average:security"], -1);
    assert.equal(bob.metrics["global-average:utility"], -1);
    assert.equal(bob.gamesPlayed, 2);
  });

  it("two challenge types — averages across challenges", async () => {
    const entries = await computeGlobal([
      makeGame({ security: 1, utility: 1 }, { security: -1, utility: -1 }, { challengeType: "psi" }),
      makeGame({ security: 1, utility: 1 }, { security: -1, utility: -1 }, { challengeType: "psi" }),
      makeGame({ security: -1, utility: -1 }, { security: 1, utility: 1 }, { challengeType: "gencrypto" }),
      makeGame({ security: -1, utility: -1 }, { security: 1, utility: 1 }, { challengeType: "gencrypto" }),
      makeGame({ security: -1, utility: -1 }, { security: 1, utility: 1 }, { challengeType: "gencrypto" }),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    // alice: psi avg=(1,1) 2 games, gencrypto avg=(-1,-1) 3 games → global avg=(0,0), totalGames=5
    assert.equal(alice.metrics["global-average:security"], 0);
    assert.equal(alice.metrics["global-average:utility"], 0);
    assert.equal(alice.gamesPlayed, 5);

    // bob: psi avg=(-1,-1) 2 games, gencrypto avg=(1,1) 3 games → global avg=(0,0), totalGames=5
    assert.equal(bob.metrics["global-average:security"], 0);
    assert.equal(bob.metrics["global-average:utility"], 0);
    assert.equal(bob.gamesPlayed, 5);
  });

  it("player in only one challenge type — still averages by challenge count", async () => {
    const games: GameResult[] = [
      makeGame({ security: 1, utility: 1 }, { security: -1, utility: -1 }, { challengeType: "psi" }),
      makeGame({ security: 1, utility: 1 }, { security: -1, utility: -1 }, { challengeType: "psi" }),
      {
        gameId: crypto.randomUUID(),
        challengeType: "gencrypto",
        createdAt: Date.now(),
        completedAt: Date.now(),
        scores: [{ security: 0.5, utility: 0.5 }, { security: -0.5, utility: -0.5 }],
        players: ["inv_c", "inv_d"],
        playerIdentities: { inv_c: "charlie", inv_d: "dave" },
      },
    ];

    const entries = await computeGlobal(games);

    const alice = entries.find((e) => e.playerId === "alice")!;
    // alice only in psi → challengeCount=1 → avg = psi scores
    assert.equal(alice.metrics["global-average:security"], 1);
    assert.equal(alice.metrics["global-average:utility"], 1);
    assert.equal(alice.gamesPlayed, 2);

    const charlie = entries.find((e) => e.playerId === "charlie")!;
    assert.equal(charlie.metrics["global-average:security"], 0.5);
    assert.equal(charlie.metrics["global-average:utility"], 0.5);
    assert.equal(charlie.gamesPlayed, 1);
  });

  it("asymmetric per-challenge scores average correctly", async () => {
    // psi: 4 games where alice scores (0.8, 0.2) on average
    // gencrypto: 2 games where alice scores (0.2, 0.8) on average
    const psiGames = [
      makeGame({ security: 1, utility: 0 }, { security: 0, utility: 0 }, { challengeType: "psi" }),
      makeGame({ security: 1, utility: 0 }, { security: 0, utility: 0 }, { challengeType: "psi" }),
      makeGame({ security: 0.6, utility: 0.4 }, { security: 0, utility: 0 }, { challengeType: "psi" }),
      makeGame({ security: 0.6, utility: 0.4 }, { security: 0, utility: 0 }, { challengeType: "psi" }),
    ];
    const gencryptoGames = [
      makeGame({ security: 0.2, utility: 0.8 }, { security: 0, utility: 0 }, { challengeType: "gencrypto" }),
      makeGame({ security: 0.2, utility: 0.8 }, { security: 0, utility: 0 }, { challengeType: "gencrypto" }),
    ];

    const entries = await computeGlobal([...psiGames, ...gencryptoGames]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    // psi avg: security=(1+1+0.6+0.6)/4=0.8, utility=(0+0+0.4+0.4)/4=0.2
    // gencrypto avg: security=0.2, utility=0.8
    // global avg: security=(0.8+0.2)/2=0.5, utility=(0.2+0.8)/2=0.5
    assert.ok(Math.abs(alice.metrics["global-average:security"] - 0.5) < 1e-10);
    assert.ok(Math.abs(alice.metrics["global-average:utility"] - 0.5) < 1e-10);
    assert.equal(alice.gamesPlayed, 6);
  });

  // ── Weighted combined propagation ──────────────────────────────────────────

  it("combined metric propagates from per-challenge weighted average", async () => {
    // single game, alice: security=1, utility=0
    // weights: securityWeight=1.5, utilityWeight=1.0
    // average:combined = (1*1.5 + 0*1.0) / 2.5 = 0.6
    // global-average:combined should also be 0.6 (single challenge)
    const entries = await computeGlobal(
      [makeGame({ security: 1, utility: 0 }, { security: 0, utility: 0 })],
      { securityWeight: 1.5, utilityWeight: 1.0 }
    );

    const alice = entries.find((e) => e.playerId === "alice")!;
    assert.ok(Math.abs(alice.metrics["global-average:combined"] - 0.6) < 1e-10);
    // security and utility averages are unaffected by weights
    assert.equal(alice.metrics["global-average:security"], 1);
    assert.equal(alice.metrics["global-average:utility"], 0);
  });

  it("combined with utility-only weights (securityWeight=0) reflects utility-only scoring", async () => {
    // alice: security=0.9, utility=0.3 → combined=(0+0.3)/1=0.3
    const entries = await computeGlobal(
      [makeGame({ security: 0.9, utility: 0.3 }, { security: 0, utility: 0 })],
      { securityWeight: 0.0, utilityWeight: 1.0 }
    );

    const alice = entries.find((e) => e.playerId === "alice")!;
    assert.ok(Math.abs(alice.metrics["global-average:combined"] - 0.3) < 1e-10);
  });
});
