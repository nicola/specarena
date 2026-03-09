import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChallenge } from "./index";
import type { ChallengeOperator, Challenge } from "@arena/engine/types";

function createOperator(): ChallengeOperator {
  return createChallenge("test-dining-id");
}

describe("DiningCryptoChallenge serialize/restore round-trip", () => {
  it("serialize returns plain JSON-safe values", () => {
    const operator = createOperator();
    const { gameState } = operator.serialize();
    const gs = gameState as { coins: unknown[]; payerIndex: unknown; announcements: unknown[] };

    assert.ok(Array.isArray(gs.coins), "coins should be an array");
    assert.equal(gs.coins.length, 3);
    assert.ok(gs.coins.every((c) => c === 0 || c === 1), "coins should be 0 or 1");
    assert.ok(gs.payerIndex === null || typeof gs.payerIndex === "number", "payerIndex should be null or number");
    assert.ok(Array.isArray(gs.announcements));
    assert.ok(gs.announcements.every((a) => a === null), "announcements should start as null");
  });

  it("round-trip through JSON.stringify/parse preserves data", () => {
    const operator = createOperator();
    const serialized = operator.serialize();
    const fromJson = JSON.parse(JSON.stringify(serialized));

    const restored = createOperator();
    restored.restore({
      id: "test-dining-id",
      name: "dining-crypto",
      createdAt: Date.now(),
      challengeType: "dining-crypto",
      invites: [],
      ...fromJson,
    } as Challenge);

    assert.deepEqual(restored.gameState.coins, operator.gameState.coins);
    assert.equal(restored.gameState.payerIndex, operator.gameState.payerIndex);
    assert.deepEqual(restored.gameState.announcements, [null, null, null]);
  });

  it("round-trip preserves mid-game announcement state", () => {
    const operator = createOperator();
    operator.state.status = "active";
    operator.state.players = ["inv_a", "inv_b", "inv_c"];
    operator.gameState.announcements[0] = 1;
    operator.gameState.announcements[1] = 0;

    const serialized = operator.serialize();
    const fromJson = JSON.parse(JSON.stringify(serialized));

    const restored = createOperator();
    restored.restore({
      id: "test-dining-id",
      name: "dining-crypto",
      createdAt: Date.now(),
      challengeType: "dining-crypto",
      invites: [],
      ...fromJson,
    } as Challenge);

    assert.equal(restored.gameState.announcements[0], 1);
    assert.equal(restored.gameState.announcements[1], 0);
    assert.equal(restored.gameState.announcements[2], null);
    assert.equal(restored.state.status, "active");
  });

  it("restore preserves operator state (scores, players, etc.)", () => {
    const operator = createOperator();
    operator.state.status = "active";
    operator.state.players = ["inv_a", "inv_b", "inv_c"];
    operator.state.playerIdentities = { inv_a: "user-1", inv_b: "user-2", inv_c: "user-3" };
    operator.state.scores[0] = { security: -1, utility: 1 };

    const serialized = operator.serialize();
    const restored = createOperator();
    restored.restore({
      id: "test-dining-id",
      name: "dining-crypto",
      createdAt: Date.now(),
      challengeType: "dining-crypto",
      invites: [],
      ...serialized,
    } as Challenge);

    assert.equal(restored.state.status, "active");
    assert.deepEqual(restored.state.players, ["inv_a", "inv_b", "inv_c"]);
    assert.equal(restored.state.scores[0].security, -1);
    assert.equal(restored.state.scores[0].utility, 1);
  });
});
