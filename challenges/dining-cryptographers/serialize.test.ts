import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChallenge } from "./index";
import type { ChallengeOperator, Challenge } from "@arena/engine/types";

function createOperator(): ChallengeOperator {
  return createChallenge("test-dining-id");
}

function makeChallenge(extra: ReturnType<ChallengeOperator["serialize"]>): Challenge {
  return {
    id: "test-dining-id",
    name: "dining-cryptographers",
    createdAt: Date.now(),
    challengeType: "dining-cryptographers",
    invites: [],
    ...extra,
  } as Challenge;
}

describe("DiningCryptographersChallenge serialize/restore round-trip", () => {
  it("serialize returns plain JSON-safe values", () => {
    const operator = createOperator();
    const { gameState } = operator.serialize();

    const gs = gameState as { payer: unknown; guesses: unknown[] };

    // payer is either a number (player index) or the string "external"
    assert.ok(
      typeof gs.payer === "number" || gs.payer === "external",
      `payer should be a number or "external", got: ${JSON.stringify(gs.payer)}`,
    );
    assert.ok(Array.isArray(gs.guesses), "guesses should be an array");
    assert.ok(
      gs.guesses.every((g) => g === null || typeof g === "string"),
      "guesses should be null or strings",
    );

    // Verify JSON round-trip doesn't throw and values survive
    const json = JSON.stringify(gameState);
    const parsed = JSON.parse(json);
    assert.deepEqual(parsed, gameState);
  });

  it("restore recovers payer and guesses from serialized state", () => {
    const operator = createOperator();
    const serialized = operator.serialize();

    const restored = createOperator();
    restored.restore(makeChallenge(serialized));

    assert.deepEqual(restored.gameState.payer, operator.gameState.payer);
    assert.deepEqual(restored.gameState.guesses, operator.gameState.guesses);
  });

  it("round-trip through JSON.stringify/parse preserves data", () => {
    const operator = createOperator();
    const serialized = operator.serialize();

    const fromJson = JSON.parse(JSON.stringify(serialized));

    const restored = createOperator();
    restored.restore(makeChallenge(fromJson));

    assert.deepEqual(restored.gameState.payer, operator.gameState.payer);
    assert.deepEqual(restored.gameState.guesses, [null, null, null]);
  });

  it("round-trip preserves mid-game guess state", () => {
    const operator = createOperator();
    operator.state.status = "active";
    operator.state.players = ["inv_a", "inv_b", "inv_c"];
    operator.gameState.guesses[0] = "external";
    operator.gameState.guesses[1] = "inv_a";

    const serialized = operator.serialize();
    const fromJson = JSON.parse(JSON.stringify(serialized));

    const restored = createOperator();
    restored.restore(makeChallenge(fromJson));

    assert.equal(restored.gameState.guesses[0], "external");
    assert.equal(restored.gameState.guesses[1], "inv_a");
    assert.equal(restored.gameState.guesses[2], null);
    assert.equal(restored.state.status, "active");
  });

  it("restore preserves operator state (scores, players, playerIdentities)", () => {
    const operator = createOperator();
    operator.state.status = "active";
    operator.state.players = ["inv_a", "inv_b", "inv_c"];
    operator.state.playerIdentities = { inv_a: "user-1", inv_b: "user-2", inv_c: "user-3" };
    operator.state.scores[0] = { security: 1, utility: 1 };
    operator.state.scores[1] = { security: 1, utility: -1 };
    operator.state.scores[2] = { security: -1, utility: 0 };

    const serialized = operator.serialize();
    const restored = createOperator();
    restored.restore(makeChallenge(serialized));

    assert.equal(restored.state.status, "active");
    assert.deepEqual(restored.state.players, ["inv_a", "inv_b", "inv_c"]);
    assert.deepEqual(restored.state.playerIdentities, {
      inv_a: "user-1",
      inv_b: "user-2",
      inv_c: "user-3",
    });
    assert.equal(restored.state.scores[0].utility, 1);
    assert.equal(restored.state.scores[1].utility, -1);
    assert.equal(restored.state.scores[2].security, -1);
  });
});
