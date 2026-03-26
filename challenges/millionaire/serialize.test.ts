import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChallenge } from "./index";
import type { ChallengeOperator, Challenge } from "@specarena/engine/types";

function createOperator(): ChallengeOperator {
  return createChallenge("test-millionaire-id");
}

describe("MillionaireChallenge serialize/restore round-trip", () => {
  it("serialize returns plain JSON-safe values", () => {
    const operator = createOperator();
    const { gameState } = operator.serialize();

    const gs = gameState as { wealth: unknown[]; guesses: unknown[] };
    assert.ok(Array.isArray(gs.wealth), "wealth should be an array");
    assert.ok(Array.isArray(gs.guesses), "guesses should be an array");
    assert.ok(gs.wealth.every(w => typeof w === "number"), "wealth values should be numbers");
    assert.ok(gs.guesses.every(g => g === null || typeof g === "number"), "guesses should be null or number");
  });

  it("restore recovers wealth and guesses from serialized state", () => {
    const operator = createOperator();
    const serialized = operator.serialize();

    const restored = createOperator();
    restored.restore({
      id: "test-millionaire-id",
      name: "millionaire",
      createdAt: Date.now(),
      challengeType: "millionaire",
      invites: [],
      ...serialized,
    } as Challenge);

    assert.deepEqual(restored.gameState.wealth, operator.gameState.wealth);
    assert.deepEqual(restored.gameState.guesses, operator.gameState.guesses);
  });

  it("round-trip through JSON.stringify/parse preserves data", () => {
    const operator = createOperator();
    const serialized = operator.serialize();

    const fromJson = JSON.parse(JSON.stringify(serialized));

    const restored = createOperator();
    restored.restore({
      id: "test-millionaire-id",
      name: "millionaire",
      createdAt: Date.now(),
      challengeType: "millionaire",
      invites: [],
      ...fromJson,
    } as Challenge);

    assert.deepEqual(restored.gameState.wealth, operator.gameState.wealth);
    assert.deepEqual(restored.gameState.guesses, [null, null]);
  });

  it("round-trip preserves mid-game guess state", () => {
    const operator = createOperator();
    operator.state.status = "active";
    operator.state.players = ["inv_a", "inv_b"];
    operator.gameState.guesses[0] = 42;

    const serialized = operator.serialize();
    const fromJson = JSON.parse(JSON.stringify(serialized));

    const restored = createOperator();
    restored.restore({
      id: "test-millionaire-id",
      name: "millionaire",
      createdAt: Date.now(),
      challengeType: "millionaire",
      invites: [],
      ...fromJson,
    } as Challenge);

    assert.equal(restored.gameState.guesses[0], 42);
    assert.equal(restored.gameState.guesses[1], null);
    assert.equal(restored.state.status, "active");
  });

  it("restore preserves operator state (scores, players, etc.)", () => {
    const operator = createOperator();
    operator.state.status = "active";
    operator.state.players = ["inv_a", "inv_b"];
    operator.state.playerIdentities = { inv_a: "user-1", inv_b: "user-2" };
    operator.state.scores[0] = { security: 1, utility: -1 };

    const serialized = operator.serialize();
    const restored = createOperator();
    restored.restore({
      id: "test-millionaire-id",
      name: "millionaire",
      createdAt: Date.now(),
      challengeType: "millionaire",
      invites: [],
      ...serialized,
    } as Challenge);

    assert.equal(restored.state.status, "active");
    assert.deepEqual(restored.state.players, ["inv_a", "inv_b"]);
    assert.deepEqual(restored.state.playerIdentities, { inv_a: "user-1", inv_b: "user-2" });
    assert.equal(restored.state.scores[0].security, 1);
    assert.equal(restored.state.scores[0].utility, -1);
  });
});
