import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { consecutive } from "../consecutive";
import { InMemoryScoringStore } from "../store";
import type { GameResult } from "../types";

function makeGame(
  attacker: { security: number; utility: number },
  victim: { security: number; utility: number },
  overrides?: Partial<GameResult>
): GameResult {
  return {
    gameId: crypto.randomUUID(),
    challengeType: "psi",
    createdAt: Date.now(),
    completedAt: Date.now(),
    scores: [attacker, victim],
    players: ["inv_attacker", "inv_victim"],
    playerIdentities: { inv_attacker: "attacker", inv_victim: "victim" },
    ...overrides,
  };
}

describe("consecutive strategy", () => {
  let store: InMemoryScoringStore;

  beforeEach(() => {
    store = new InMemoryScoringStore();
  });

  async function computeEntries(games: GameResult[]) {
    for (const game of games) {
      await consecutive.update(game, store);
    }
    const scores = await store.getScores("psi");
    return scores["consecutive"] ?? [];
  }

  it("declares metric descriptors", () => {
    assert.deepStrictEqual(consecutive.metrics, [
      { key: "consecutive:security", label: "Security Streak" },
      { key: "consecutive:utility", label: "Utility Streak" },
      { key: "consecutive:attack", label: "Attack Streak" },
    ]);
  });

  it("first win — streaks start at 1", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),
    ]);

    const attacker = entries.find((e) => e.playerId === "attacker")!;
    const victim = entries.find((e) => e.playerId === "victim")!;

    assert.equal(attacker.metrics["consecutive:security"], 1);
    assert.equal(attacker.metrics["consecutive:utility"], 1);
    assert.equal(attacker.metrics["consecutive:attack"], 0);
    assert.equal(attacker.metrics["games_played:count"], 1);

    assert.equal(victim.metrics["consecutive:security"], 1);
    assert.equal(victim.metrics["consecutive:utility"], 1);
    assert.equal(victim.metrics["consecutive:attack"], 0);
    assert.equal(victim.metrics["games_played:count"], 1);
  });

  it("consecutive wins — streaks increment", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),
    ]);

    const attacker = entries.find((e) => e.playerId === "attacker")!;
    assert.equal(attacker.metrics["consecutive:security"], 3);
    assert.equal(attacker.metrics["consecutive:utility"], 3);
    assert.equal(attacker.metrics["games_played:count"], 3);
  });

  it("loss resets streak to 0", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),
      makeGame({ security: 0, utility: 0 }, { security: 0, utility: 0 }),
    ]);

    const attacker = entries.find((e) => e.playerId === "attacker")!;
    assert.equal(attacker.metrics["consecutive:security"], 0);
    assert.equal(attacker.metrics["consecutive:utility"], 0);
    assert.equal(attacker.metrics["games_played:count"], 3);
  });

  it("streak restarts after a reset", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),
      makeGame({ security: 0, utility: 0 }, { security: 0, utility: 0 }),  // reset
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),  // restart
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),
    ]);

    const attacker = entries.find((e) => e.playerId === "attacker")!;
    assert.equal(attacker.metrics["consecutive:security"], 2);
    assert.equal(attacker.metrics["consecutive:utility"], 2);
    assert.equal(attacker.metrics["games_played:count"], 5);
  });

  it("independent dimensions — security can reset while utility continues", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),
      makeGame({ security: 0, utility: 1 }, { security: 0, utility: 1 }),  // security resets
    ]);

    const attacker = entries.find((e) => e.playerId === "attacker")!;
    assert.equal(attacker.metrics["consecutive:security"], 0);
    assert.equal(attacker.metrics["consecutive:utility"], 2);
  });

  it("attack streak — increments on breach", async () => {
    const entries = await computeEntries([
      makeGame(
        { security: 1, utility: 1 },
        { security: -1, utility: -1 },
        { attributions: [{ from: 0, to: 1, type: "security_breach" }] }
      ),
      makeGame(
        { security: 1, utility: 1 },
        { security: -1, utility: -1 },
        { attributions: [{ from: 0, to: 1, type: "security_breach" }] }
      ),
    ]);

    const attacker = entries.find((e) => e.playerId === "attacker")!;
    assert.equal(attacker.metrics["consecutive:attack"], 2);

    const victim = entries.find((e) => e.playerId === "victim")!;
    assert.equal(victim.metrics["consecutive:attack"], 0);
  });

  it("attack streak resets when no breach", async () => {
    const entries = await computeEntries([
      makeGame(
        { security: 1, utility: 1 },
        { security: -1, utility: -1 },
        { attributions: [{ from: 0, to: 1, type: "security_breach" }] }
      ),
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),  // no breach
    ]);

    const attacker = entries.find((e) => e.playerId === "attacker")!;
    assert.equal(attacker.metrics["consecutive:attack"], 0);
  });

  it("non-security_breach attributions are ignored for attack", async () => {
    const entries = await computeEntries([
      makeGame(
        { security: 1, utility: 1 },
        { security: 1, utility: 1 },
        { attributions: [{ from: 0, to: 1, type: "other_event" }] }
      ),
    ]);

    const attacker = entries.find((e) => e.playerId === "attacker")!;
    assert.equal(attacker.metrics["consecutive:attack"], 0);
  });

  it("missing playerIdentities — skipped gracefully", async () => {
    const entries = await computeEntries([
      makeGame(
        { security: 1, utility: 1 },
        { security: 1, utility: 1 },
        { playerIdentities: { inv_attacker: "attacker" } }  // victim missing
      ),
    ]);

    assert.deepStrictEqual(entries, []);
  });

  it("single-player game — skipped", async () => {
    const entries = await computeEntries([
      {
        gameId: "g1",
        challengeType: "psi",
        createdAt: Date.now(),
        completedAt: Date.now(),
        scores: [{ security: 1, utility: 1 }],
        players: ["inv_attacker"],
        playerIdentities: { inv_attacker: "attacker" },
      },
    ]);

    assert.deepStrictEqual(entries, []);
  });
});
