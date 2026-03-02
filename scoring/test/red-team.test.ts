import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { redTeam } from "../red-team";
import { InMemoryScoringStore } from "../store";
import type { GameResult, Attribution } from "../types";

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

  it("attacker breaches victim — attacker utility=1", async () => {
    const entries = await computeEntries([
      makeGame(
        { security: 1, utility: 1 },
        { security: -1, utility: -1 },
        { attributions: [{ from: 0, to: 1, type: "security_breach" }] }
      ),
    ]);

    const attacker = entries.find((e) => e.playerId === "attacker")!;
    const victim = entries.find((e) => e.playerId === "victim")!;

    assert.equal(attacker.utility, 1);     // caused 1 breach in 1 game
    assert.equal(attacker.security, 0);
    assert.equal(attacker.gamesPlayed, 1);

    assert.equal(victim.utility, 0);       // caused 0 breaches
    assert.equal(victim.security, 0);
    assert.equal(victim.gamesPlayed, 1);
  });

  it("no attributions — both players get utility=0", async () => {
    const entries = await computeEntries([
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),
    ]);

    const attacker = entries.find((e) => e.playerId === "attacker")!;
    const victim = entries.find((e) => e.playerId === "victim")!;

    assert.equal(attacker.utility, 0);
    assert.equal(attacker.security, 0);
    assert.equal(victim.utility, 0);
    assert.equal(victim.security, 0);
  });

  it("multi-game — attack rate accumulates correctly", async () => {
    const entries = await computeEntries([
      // Game 1: attacker breaches victim
      makeGame(
        { security: 1, utility: 1 },
        { security: -1, utility: -1 },
        { attributions: [{ from: 0, to: 1, type: "security_breach" }] }
      ),
      // Game 2: no breach
      makeGame({ security: 1, utility: 1 }, { security: 1, utility: 1 }),
      // Game 3: victim breaches attacker
      makeGame(
        { security: -1, utility: -1 },
        { security: 1, utility: 1 },
        { attributions: [{ from: 1, to: 0, type: "security_breach" }] }
      ),
    ]);

    const attacker = entries.find((e) => e.playerId === "attacker")!;
    const victim = entries.find((e) => e.playerId === "victim")!;

    assert.equal(attacker.gamesPlayed, 3);
    assert.ok(Math.abs(attacker.utility - 1 / 3) < 1e-10);  // 1 breach in 3 games
    assert.equal(attacker.security, 0);

    assert.equal(victim.gamesPlayed, 3);
    assert.ok(Math.abs(victim.utility - 1 / 3) < 1e-10);    // 1 breach in 3 games
    assert.equal(victim.security, 0);
  });

  it("missing playerIdentities — skipped gracefully", async () => {
    const entries = await computeEntries([
      makeGame(
        { security: 1, utility: 1 },
        { security: -1, utility: -1 },
        {
          attributions: [{ from: 0, to: 1, type: "security_breach" }],
          playerIdentities: { inv_attacker: "attacker" }, // victim missing
        }
      ),
    ]);

    assert.deepStrictEqual(entries, []);
  });

  it("non-security_breach attributions are ignored", async () => {
    const entries = await computeEntries([
      makeGame(
        { security: 1, utility: 1 },
        { security: 1, utility: 1 },
        { attributions: [{ from: 0, to: 1, type: "other_event" }] }
      ),
    ]);

    const attacker = entries.find((e) => e.playerId === "attacker")!;
    const victim = entries.find((e) => e.playerId === "victim")!;

    assert.equal(attacker.utility, 0);
    assert.equal(attacker.security, 0);
    assert.equal(victim.utility, 0);
    assert.equal(victim.security, 0);
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

  it("mutual breach — both players get utility=1", async () => {
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

    const attacker = entries.find((e) => e.playerId === "attacker")!;
    const victim = entries.find((e) => e.playerId === "victim")!;

    assert.equal(attacker.utility, 1);   // breached victim
    assert.equal(attacker.security, 0);
    assert.equal(victim.utility, 1);     // breached attacker
    assert.equal(victim.security, 0);
  });
});
