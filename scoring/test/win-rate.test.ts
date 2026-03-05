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

describe("win-rate strategy (threshold-based)", () => {
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
      { key: "win-rate:security", label: "Security Win Rate" },
      { key: "win-rate:utility", label: "Utility Win Rate" },
    ]);
  });

  it("returns empty for no results", async () => {
    const entries = await computeEntries([]);
    assert.deepStrictEqual(entries, []);
  });

  it("both players score >= 1 — both get win-rate 1", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    assert.equal(alice.metrics["win-rate:security"], 1);
    assert.equal(alice.metrics["win-rate:utility"], 1);
    assert.equal(bob.metrics["win-rate:security"], 1);
    assert.equal(bob.metrics["win-rate:utility"], 1);
  });

  it("score < 1 counts as loss", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: -1 }, { security: -1, utility: 1 }),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    assert.equal(alice.metrics["win-rate:security"], 1);
    assert.equal(alice.metrics["win-rate:utility"], 0);
    assert.equal(bob.metrics["win-rate:security"], 0);
    assert.equal(bob.metrics["win-rate:utility"], 1);
  });

  it("both players lose — both get 0", async () => {
    const entries = await computeEntries([
      makeGame({ security: -1, utility: -1 }, { security: -1, utility: -1 }),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    assert.equal(alice.metrics["win-rate:security"], 0);
    assert.equal(alice.metrics["win-rate:utility"], 0);
    assert.equal(bob.metrics["win-rate:security"], 0);
    assert.equal(bob.metrics["win-rate:utility"], 0);
  });

  it("multiple games — accumulates correctly", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: 1 }, { security: -1, utility: -1 }),
      makeGame({ security: 1, utility: -1 }, { security: 1, utility: 1 }),
      makeGame({ security: -1, utility: 1 }, { security: 1, utility: -1 }),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    // alice: security wins 2/3, utility wins 2/3
    assert.ok(Math.abs(alice.metrics["win-rate:security"] - 2 / 3) < 1e-10);
    assert.ok(Math.abs(alice.metrics["win-rate:utility"] - 2 / 3) < 1e-10);
    assert.equal(alice.metrics["games_played:count"], 3);

    // bob: security wins 2/3, utility wins 1/3
    assert.ok(Math.abs(bob.metrics["win-rate:security"] - 2 / 3) < 1e-10);
    assert.ok(Math.abs(bob.metrics["win-rate:utility"] - 1 / 3) < 1e-10);
    assert.equal(bob.metrics["games_played:count"], 3);
  });

  it("works with any number of players (not just 2)", async () => {
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

    assert.equal(entries.length, 1);
    assert.equal(entries[0].metrics["win-rate:security"], 1);
    assert.equal(entries[0].metrics["win-rate:utility"], 1);
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

    assert.equal(entries.length, 1);
    assert.equal(entries[0].playerId, "alice");
  });
});
