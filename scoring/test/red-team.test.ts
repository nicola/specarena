import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { redTeam } from "../red-team";
import { InMemoryScoringStore } from "../store";
import type { GameResult, Attribution } from "../types";

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

describe("red-team strategy", () => {
  let store: InMemoryScoringStore;

  beforeEach(() => {
    store = new InMemoryScoringStore();
  });

  async function computeEntries(games: GameResult[]) {
    for (const game of games) {
      await redTeam.update(game, store);
    }
    const scores = await store.getScores("psi");
    return scores["red-team"] ?? [];
  }

  it("one breach — attacker gets utility=1, victim gets security=0", async () => {
    const entries = await computeEntries([
      makeGame(
        { security: 1, utility: 1 },
        { security: -1, utility: -1 },
        { attributions: [{ from: 0, to: 1, type: "security_breach" }] }
      ),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    assert.equal(alice.utility, 1);    // caused 1 breach in 1 game
    assert.equal(alice.security, 0);   // security always 0
    assert.equal(alice.gamesPlayed, 1);

    assert.equal(bob.utility, 0);      // caused 0 breaches
    assert.equal(bob.security, 0);     // security always 0
    assert.equal(bob.gamesPlayed, 1);
  });

  it("no attributions — all players get utility=0, security=0", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    assert.equal(alice.utility, 0);
    assert.equal(alice.security, 0);
    assert.equal(bob.utility, 0);
    assert.equal(bob.security, 0);
  });

  it("multi-game accumulation — rates computed correctly", async () => {
    const entries = await computeEntries([
      // Game 1: alice breaches bob
      makeGame(
        { security: 1, utility: 1 },
        { security: -1, utility: -1 },
        { attributions: [{ from: 0, to: 1, type: "security_breach" }] }
      ),
      // Game 2: no breach
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),
      // Game 3: bob breaches alice
      makeGame(
        { security: -1, utility: -1 },
        { security: 1, utility: 1 },
        { attributions: [{ from: 1, to: 0, type: "security_breach" }] }
      ),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    assert.equal(alice.gamesPlayed, 3);
    assert.ok(Math.abs(alice.utility - 1 / 3) < 1e-10);   // 1 breach in 3 games
    assert.equal(alice.security, 0);

    assert.equal(bob.gamesPlayed, 3);
    assert.ok(Math.abs(bob.utility - 1 / 3) < 1e-10);     // 1 breach in 3 games
    assert.equal(bob.security, 0);
  });

  it("missing playerIdentities — skipped gracefully", async () => {
    const entries = await computeEntries([
      makeGame(
        { security: 1, utility: 1 },
        { security: -1, utility: -1 },
        {
          attributions: [{ from: 0, to: 1, type: "security_breach" }],
          playerIdentities: { inv_a: "alice" }, // inv_b missing
        }
      ),
    ]);

    assert.deepStrictEqual(entries, []);
  });

  it("skips non-security_breach attributions", async () => {
    const entries = await computeEntries([
      makeGame(
        { security: 1, utility: 1 },
        { security: 1, utility: 1 },
        { attributions: [{ from: 0, to: 1, type: "other_event" }] }
      ),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    // No security_breach attributions, so both should have utility=0
    assert.equal(alice.utility, 0);
    assert.equal(alice.security, 0);
    assert.equal(bob.utility, 0);
    assert.equal(bob.security, 0);
  });

  it("skips single-player games", async () => {
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

  it("mutual breach — both players breach each other", async () => {
    const entries = await computeEntries([
      makeGame(
        { security: -1, utility: 1 },
        { security: -1, utility: 1 },
        {
          attributions: [
            { from: 0, to: 1, type: "security_breach" },
            { from: 1, to: 0, type: "security_breach" },
          ],
        }
      ),
    ]);

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    assert.equal(alice.utility, 1);    // breached bob
    assert.equal(alice.security, 0);
    assert.equal(bob.utility, 1);      // breached alice
    assert.equal(bob.security, 0);
  });
});
