import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { BaseChallenge } from "../challenge-design/BaseChallenge";
import { Challenge, ChallengeStatus, GameCategory } from "../types";

// Minimal concrete subclass for testing
interface TestGameState {
  acceptances: boolean[];
  nested: { items: number[] };
}

class TestChallenge extends BaseChallenge<TestGameState> {
  constructor(challengeId: string) {
    super(challengeId, 2, {
      acceptances: [false, false],
      nested: { items: [1, 2, 3] },
    });
  }
}

function makeChallengeRecord(gameState: TestGameState): Challenge<TestGameState> {
  return {
    id: "test-1",
    name: "Test",
    createdAt: Date.now(),
    challengeType: "test",
    invites: ["inv-a", "inv-b"],
    gameCategory: "test" as GameCategory,
    state: {
      status: ChallengeStatus.Active,
      scores: [{ security: 0, utility: 0 }, { security: 0, utility: 0 }],
      players: ["inv-a", "inv-b"],
      playerIdentities: {},
    },
    gameState,
  };
}

describe("BaseChallenge deep copy in restore/serialize", () => {
  it("restore() deep-copies gameState — mutating restored arrays does not affect source", () => {
    const operator = new TestChallenge("c1");
    const originalGameState: TestGameState = {
      acceptances: [true, false],
      nested: { items: [10, 20, 30] },
    };
    const challenge = makeChallengeRecord(originalGameState);

    operator.restore(challenge);

    // Mutate the operator's restored gameState
    operator.gameState.acceptances.push(true);
    operator.gameState.nested.items[0] = 999;

    // Original data must be unchanged
    assert.deepStrictEqual(originalGameState.acceptances, [true, false]);
    assert.deepStrictEqual(originalGameState.nested.items, [10, 20, 30]);
  });

  it("restore() deep-copies state — mutating restored players does not affect source", () => {
    const operator = new TestChallenge("c2");
    const challenge = makeChallengeRecord({ acceptances: [], nested: { items: [] } });

    operator.restore(challenge);

    // Mutate the operator's restored state
    operator.state.players.push("inv-c");
    operator.state.scores[0].utility = 99;

    // Original data must be unchanged
    assert.deepStrictEqual(challenge.state.players, ["inv-a", "inv-b"]);
    assert.equal(challenge.state.scores[0].utility, 0);
  });

  it("serialize() deep-copies — mutating operator after serialize does not affect serialized output", () => {
    const operator = new TestChallenge("c3");
    const challenge = makeChallengeRecord({
      acceptances: [false, false],
      nested: { items: [1, 2] },
    });
    operator.restore(challenge);

    const serialized = operator.serialize();

    // Mutate operator after serializing
    operator.gameState.acceptances[0] = true;
    operator.state.scores[0].utility = 50;

    // Serialized output must be unchanged
    assert.deepStrictEqual(serialized.gameState.acceptances, [false, false]);
    assert.equal(serialized.state.scores[0].utility, 0);
  });
});
