import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChallenge } from "./index";
import type { ChallengeOperator, Challenge } from "@arena/engine/types";

function createOperator(options?: Record<string, unknown>): ChallengeOperator {
  return createChallenge("test-ultimatum-id", options);
}

function makeChallenge(extra: ReturnType<ChallengeOperator["serialize"]>): Challenge {
  return {
    id: "test-ultimatum-id",
    name: "ultimatum",
    createdAt: Date.now(),
    challengeType: "ultimatum",
    invites: [],
    ...extra,
  } as Challenge;
}

describe("UltimatumChallenge serialize/restore round-trip", () => {
  it("serialize returns plain JSON-safe values", () => {
    const operator = createOperator({ reservationValues: [20, 30] });
    const { gameState } = operator.serialize();

    const gs = gameState as {
      total: unknown;
      maxRounds: unknown;
      turnOrder: unknown;
      reservationValues: unknown;
      currentOffer: unknown;
      lastOfferBy: unknown;
      acceptances: unknown;
      totalTurns: unknown;
    };

    assert.equal(typeof gs.total, "number", "total should be a number");
    assert.equal(typeof gs.maxRounds, "number", "maxRounds should be a number");
    assert.equal(typeof gs.turnOrder, "string", "turnOrder should be a string");
    assert.ok(Array.isArray(gs.reservationValues), "reservationValues should be an array");
    assert.ok(
      gs.currentOffer === null || Array.isArray(gs.currentOffer),
      "currentOffer should be null or an array",
    );
    assert.ok(
      gs.lastOfferBy === null || typeof gs.lastOfferBy === "number",
      "lastOfferBy should be null or a number",
    );
    assert.ok(Array.isArray(gs.acceptances), "acceptances should be an array");
    assert.equal(typeof gs.totalTurns, "number", "totalTurns should be a number");

    // Verify JSON round-trip doesn't throw and values survive
    const json = JSON.stringify(gameState);
    const parsed = JSON.parse(json);
    assert.deepEqual(parsed, gameState);
  });

  it("restore recovers initial game state", () => {
    const operator = createOperator({ reservationValues: [20, 30] });
    const serialized = operator.serialize();

    const restored = createOperator({ reservationValues: [20, 30] });
    restored.restore(makeChallenge(serialized));

    assert.deepEqual(restored.gameState.reservationValues, operator.gameState.reservationValues);
    assert.equal(restored.gameState.total, operator.gameState.total);
    assert.equal(restored.gameState.maxRounds, operator.gameState.maxRounds);
    assert.equal(restored.gameState.turnOrder, operator.gameState.turnOrder);
    assert.equal(restored.gameState.currentOffer, null);
    assert.equal(restored.gameState.lastOfferBy, null);
    assert.equal(restored.gameState.totalTurns, 0);
  });

  it("round-trip through JSON.stringify/parse preserves data", () => {
    const operator = createOperator({ reservationValues: [20, 30] });
    const serialized = operator.serialize();

    const fromJson = JSON.parse(JSON.stringify(serialized));

    const restored = createOperator({ reservationValues: [20, 30] });
    restored.restore(makeChallenge(fromJson));

    assert.deepEqual(restored.gameState.reservationValues, operator.gameState.reservationValues);
    assert.equal(restored.gameState.total, operator.gameState.total);
    assert.equal(restored.gameState.maxRounds, operator.gameState.maxRounds);
  });

  it("round-trip preserves mid-game state (offer on table)", async () => {
    const operator = createOperator({ reservationValues: [20, 30] });
    operator.state.status = "active";
    operator.state.players = ["inv_a", "inv_b"];
    operator.gameState.currentOffer = [60, 40];
    operator.gameState.lastOfferBy = 0;
    operator.gameState.acceptances = [true, false];
    operator.gameState.totalTurns = 1;

    const serialized = operator.serialize();
    const fromJson = JSON.parse(JSON.stringify(serialized));

    const restored = createOperator({ reservationValues: [20, 30] });
    restored.restore(makeChallenge(fromJson));

    assert.deepEqual(restored.gameState.currentOffer, [60, 40]);
    assert.equal(restored.gameState.lastOfferBy, 0);
    assert.deepEqual(restored.gameState.acceptances, [true, false]);
    assert.equal(restored.gameState.totalTurns, 1);
    assert.equal(restored.state.status, "active");
  });

  it("restore preserves operator state (scores, players, playerIdentities)", () => {
    const operator = createOperator({ reservationValues: [20, 30] });
    operator.state.status = "active";
    operator.state.players = ["inv_a", "inv_b"];
    operator.state.playerIdentities = { inv_a: "user-1", inv_b: "user-2" };
    operator.state.scores[0] = { security: 0, utility: 0.4 };
    operator.state.scores[1] = { security: 0, utility: 0.1 };

    const serialized = operator.serialize();
    const restored = createOperator({ reservationValues: [20, 30] });
    restored.restore(makeChallenge(serialized));

    assert.equal(restored.state.status, "active");
    assert.deepEqual(restored.state.players, ["inv_a", "inv_b"]);
    assert.deepEqual(restored.state.playerIdentities, { inv_a: "user-1", inv_b: "user-2" });
    assert.equal(restored.state.scores[0].utility, 0.4);
    assert.equal(restored.state.scores[1].utility, 0.1);
  });
});
