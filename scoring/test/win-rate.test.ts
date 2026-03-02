import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { winRate } from "../win-rate";
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

describe("win-rate strategy", () => {
  let store: InMemoryScoringStore;

  beforeEach(() => {
    store = new InMemoryScoringStore();
  });

  async function computeEntries(games: GameResult[]) {
    for (const game of games) {
      await winRate.update(game, store);
    }
    const scores = await store.getScores("psi");
    return scores["win-rate"] ?? [];
  }

  it("declares metric descriptors", () => {
    assert.deepStrictEqual(winRate.metrics, [
      { key: "win-rate:security", label: "Security" },
      { key: "win-rate:utility", label: "Utility" },
    ]);
  });

  it("returns empty for no results", async () => {
    const entries = await computeEntries([]);
    assert.deepStrictEqual(entries, []);
  });

  it("clear winner — (1,1) vs (-1,-1)", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: 1 }, { security: -1, utility: -1 }),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    assert.equal(alice.metrics["win-rate:security"], 1);   // won security
    assert.equal(alice.metrics["win-rate:utility"], 1);    // won utility
    assert.equal(alice.gamesPlayed, 1);

    assert.equal(bob.metrics["win-rate:security"], 0);     // lost security
    assert.equal(bob.metrics["win-rate:utility"], 0);      // lost utility
    assert.equal(bob.gamesPlayed, 1);
  });

  it("tie game — both get 0.5", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    assert.equal(alice.metrics["win-rate:security"], 0.5);
    assert.equal(alice.metrics["win-rate:utility"], 0.5);
    assert.equal(bob.metrics["win-rate:security"], 0.5);
    assert.equal(bob.metrics["win-rate:utility"], 0.5);
  });

  it("split dimensions — one wins security, other wins utility", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: -1 }, { security: -1, utility: 1 }),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    assert.equal(alice.metrics["win-rate:security"], 1);   // won security
    assert.equal(alice.metrics["win-rate:utility"], 0);    // lost utility
    assert.equal(bob.metrics["win-rate:security"], 0);     // lost security
    assert.equal(bob.metrics["win-rate:utility"], 1);      // won utility
  });

  it("two games — alternating winners gives 0.5 each", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: 1 }, { security: -1, utility: -1 }),
      makeGame({ security: -1, utility: -1 }, { security: 1, utility: 1 }),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    assert.equal(alice.metrics["win-rate:security"], 0.5);
    assert.equal(alice.metrics["win-rate:utility"], 0.5);
    assert.equal(alice.gamesPlayed, 2);

    assert.equal(bob.metrics["win-rate:security"], 0.5);
    assert.equal(bob.metrics["win-rate:utility"], 0.5);
    assert.equal(bob.gamesPlayed, 2);
  });

  it("three games — 2 wins out of 3", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: 1 }, { security: -1, utility: -1 }),
      makeGame({ security: 1, utility: 1 }, { security: -1, utility: -1 }),
      makeGame({ security: -1, utility: -1 }, { security: 1, utility: 1 }),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    assert.ok(Math.abs(alice.metrics["win-rate:security"] - 2 / 3) < 1e-10);
    assert.ok(Math.abs(alice.metrics["win-rate:utility"] - 2 / 3) < 1e-10);
    assert.ok(Math.abs(bob.metrics["win-rate:security"] - 1 / 3) < 1e-10);
    assert.ok(Math.abs(bob.metrics["win-rate:utility"] - 1 / 3) < 1e-10);
  });

  it("skips non-2-player games", async () => {
    const entries = await computeEntries([
      {
        gameId: "g1",
        challengeType: "psi",
        createdAt: Date.now(),
        completedAt: Date.now(),
        scores: [{ security: 1, utility: 1 }],
        players: ["inv_a"],
        playerIdentities: { inv_a: "alice" },
      },
    ]);

    assert.deepStrictEqual(entries, []);
  });

  it("skips players without identity", async () => {
    const entries = await computeEntries([
      {
        gameId: "g1",
        challengeType: "psi",
        createdAt: Date.now(),
        completedAt: Date.now(),
        scores: [{ security: 1, utility: 1 }, { security: -1, utility: -1 }],
        players: ["inv_a", "inv_b"],
        playerIdentities: { inv_a: "alice" }, // inv_b missing
      },
    ]);

    assert.deepStrictEqual(entries, []);
  });
});
