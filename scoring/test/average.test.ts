import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
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

describe("average strategy", () => {
  let store: InMemoryScoringStore;

  beforeEach(() => {
    store = new InMemoryScoringStore();
  });

  async function computeEntries(games: GameResult[]) {
    for (const game of games) {
      await average.update(game, store);
    }
    const scores = await store.getScores("psi");
    return scores["average"] ?? [];
  }

  it("declares metric descriptors", () => {
    assert.deepStrictEqual(average.metrics, [
      { key: "average:security", label: "Security" },
      { key: "average:utility", label: "Utility" },
    ]);
  });

  it("returns empty for no results", async () => {
    const entries = await computeEntries([]);
    assert.deepStrictEqual(entries, []);
  });

  it("single game — scores are the averages", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: 1 }, { security: -1, utility: -1 }),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    assert.equal(alice.metrics["average:security"], 1);
    assert.equal(alice.metrics["average:utility"], 1);
    assert.equal(alice.metrics["games_played:count"], 1);

    assert.equal(bob.metrics["average:security"], -1);
    assert.equal(bob.metrics["average:utility"], -1);
    assert.equal(bob.metrics["games_played:count"], 1);
  });

  it("two games — averages the scores", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: 1 }, { security: -1, utility: -1 }),
      makeGame({ security: -1, utility: -1 }, { security: 1, utility: 1 }),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    assert.equal(alice.metrics["average:security"], 0);
    assert.equal(alice.metrics["average:utility"], 0);
    assert.equal(alice.metrics["games_played:count"], 2);

    assert.equal(bob.metrics["average:security"], 0);
    assert.equal(bob.metrics["average:utility"], 0);
    assert.equal(bob.metrics["games_played:count"], 2);
  });

  it("asymmetric scores average correctly", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: 2 }, { security: -1, utility: 0 }),
      makeGame({ security: 1, utility: 0 }, { security: -1, utility: 2 }),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    assert.equal(alice.metrics["average:security"], 1);
    assert.equal(alice.metrics["average:utility"], 1);
    assert.equal(bob.metrics["average:security"], -1);
    assert.equal(bob.metrics["average:utility"], 1);
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
        playerIdentities: { inv_a: "alice" }, // inv_b has no identity
      },
    ]);

    assert.equal(entries.length, 1);
    assert.equal(entries[0].playerId, "alice");
  });

  it("three games with different opponents", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: 1 }, { security: -1, utility: -1 }),
      {
        gameId: "g2",
        challengeType: "psi",
        createdAt: Date.now(),
        completedAt: Date.now(),
        scores: [{ security: 1, utility: 1 }, { security: 0, utility: 0 }],
        players: ["inv_a", "inv_c"],
        playerIdentities: { inv_a: "alice", inv_c: "charlie" },
      },
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    assert.equal(alice.metrics["games_played:count"], 2);
    assert.equal(alice.metrics["average:security"], 1); // (1+1)/2
    assert.equal(alice.metrics["average:utility"], 1); // (1+1)/2

    const charlie = entries.find((e) => e.playerId === "charlie")!;
    assert.equal(charlie.metrics["games_played:count"], 1);
    assert.equal(charlie.metrics["average:security"], 0);
    assert.equal(charlie.metrics["average:utility"], 0);
  });
});
