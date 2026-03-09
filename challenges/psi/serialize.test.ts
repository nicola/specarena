import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChallenge } from "./index";
import type { ChallengeOperator, Challenge } from "@arena/engine/types";

function createOperator(): ChallengeOperator {
  return createChallenge("test-challenge-id");
}

describe("PsiChallenge serialize/restore round-trip", () => {
  it("serialize returns plain arrays, not Sets", () => {
    const operator = createOperator();
    const { gameState } = operator.serialize();

    const gs = gameState as { userSets: unknown[]; intersectionSet: unknown; guesses: unknown[] };
    assert.ok(Array.isArray(gs.userSets[0]), "userSets elements should be arrays");
    assert.ok(!(gs.userSets[0] instanceof Set), "userSets elements must not be Sets");
    assert.ok(Array.isArray(gs.intersectionSet), "intersectionSet should be an array");
    assert.ok(!(gs.intersectionSet instanceof Set), "intersectionSet must not be a Set");
    assert.ok(Array.isArray(gs.guesses[0]), "guesses elements should be arrays");
  });

  it("restore recovers Sets from serialized arrays", () => {
    const operator = createOperator();
    const serialized = operator.serialize();

    // Create a fresh operator and restore from serialized data
    const restored = createOperator();
    restored.restore({
      id: "test-challenge-id",
      name: "psi",
      createdAt: Date.now(),
      challengeType: "psi",
      invites: [],
      ...serialized,
    } as Challenge);

    // The restored operator should have Sets internally
    assert.ok(restored.gameState.userSets[0] instanceof Set, "userSets should be restored as Sets");
    assert.ok(restored.gameState.intersectionSet instanceof Set, "intersectionSet should be restored as a Set");
    assert.ok(restored.gameState.guesses[0] instanceof Set, "guesses should be restored as Sets");
  });

  it("round-trip preserves all set contents", () => {
    const original = createOperator();
    const originalSets = original.gameState.userSets.map((s) => new Set(s));
    const originalIntersection = new Set(original.gameState.intersectionSet);

    const serialized = original.serialize();

    const restored = createOperator();
    restored.restore({
      id: "test-challenge-id",
      name: "psi",
      createdAt: Date.now(),
      challengeType: "psi",
      invites: [],
      ...serialized,
    } as Challenge);

    // Verify all elements survived the round-trip
    for (let i = 0; i < originalSets.length; i++) {
      assert.equal(restored.gameState.userSets[i].size, originalSets[i].size, `userSet ${i} size should match`);
      for (const n of originalSets[i]) {
        assert.ok(restored.gameState.userSets[i].has(n), `userSet ${i} should contain ${n}`);
      }
    }

    assert.equal(restored.gameState.intersectionSet.size, originalIntersection.size);
    for (const n of originalIntersection) {
      assert.ok(restored.gameState.intersectionSet.has(n), `intersectionSet should contain ${n}`);
    }
  });

  it("round-trip through JSON.stringify/parse preserves data", () => {
    const operator = createOperator();
    const serialized = operator.serialize();

    // Simulate what a SQL adapter would do
    const jsonString = JSON.stringify(serialized);
    const fromJson = JSON.parse(jsonString);

    const restored = createOperator();
    restored.restore({
      id: "test-challenge-id",
      name: "psi",
      createdAt: Date.now(),
      challengeType: "psi",
      invites: [],
      ...fromJson,
    } as Challenge);

    // Should still have working Sets after full JSON round-trip
    assert.ok(restored.gameState.userSets[0] instanceof Set);
    assert.equal(restored.gameState.userSets[0].size, operator.gameState.userSets[0].size);
    for (const n of operator.gameState.userSets[0]) {
      assert.ok(restored.gameState.userSets[0].has(n));
    }
  });

  it("restore preserves operator state (scores, players, etc.)", () => {
    const operator = createOperator();

    // Simulate a mid-game state
    operator.state.status = "active";
    operator.state.players = ["inv_a", "inv_b"];
    operator.state.playerIdentities = { inv_a: "user-1", inv_b: "user-2" };
    operator.state.scores[0] = { security: 1, utility: 0.5 };

    const serialized = operator.serialize();

    const restored = createOperator();
    restored.restore({
      id: "test-challenge-id",
      name: "psi",
      createdAt: Date.now(),
      challengeType: "psi",
      invites: [],
      ...serialized,
    } as Challenge);

    assert.equal(restored.state.status, "active");
    assert.deepEqual(restored.state.players, ["inv_a", "inv_b"]);
    assert.deepEqual(restored.state.playerIdentities, { inv_a: "user-1", inv_b: "user-2" });
    assert.equal(restored.state.scores[0].security, 1);
    assert.equal(restored.state.scores[0].utility, 0.5);
  });

  it("serialized guesses survive round-trip after a guess is made", async () => {
    const operator = createOperator();

    // Simulate joining
    operator.state.status = "active";
    operator.state.players = ["inv_a", "inv_b"];

    // Simulate a guess by directly setting it
    operator.gameState.guesses[0] = new Set([100, 200, 300]);

    const serialized = operator.serialize();
    const gs = serialized.gameState as { guesses: number[][] };
    assert.deepEqual(gs.guesses[0].sort(), [100, 200, 300]);
    assert.deepEqual(gs.guesses[1], []);

    // Restore and verify
    const restored = createOperator();
    restored.restore({
      id: "test-challenge-id",
      name: "psi",
      createdAt: Date.now(),
      challengeType: "psi",
      invites: [],
      ...serialized,
    } as Challenge);

    assert.ok(restored.gameState.guesses[0] instanceof Set);
    assert.equal(restored.gameState.guesses[0].size, 3);
    assert.ok(restored.gameState.guesses[0].has(100));
    assert.ok(restored.gameState.guesses[0].has(200));
    assert.ok(restored.gameState.guesses[0].has(300));
    assert.equal(restored.gameState.guesses[1].size, 0);
  });
});
