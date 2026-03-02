import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChatEngine, InMemoryChatStorageAdapter } from "@arena/engine/engine";
import { createChallenge } from "./index";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/**
 * Create an UltimatumChallenge wired to a real ChatEngine so we can
 * inspect messages via chat.challengeSync(). This mirrors the PSI test
 * pattern in challenges/psi/challenge-operator.test.ts.
 */
function createUltimatumWithChat(
  challengeId: string,
  options?: Record<string, unknown>,
) {
  const chat = createChatEngine({ storageAdapter: new InMemoryChatStorageAdapter() });
  const operator = createChallenge(challengeId, options, { messaging: chat });
  return { operator, chat };
}

/** Shorthand to send a typed action to the operator */
async function act(
  operator: ReturnType<typeof createChallenge>,
  from: string,
  type: string,
  content: string = "",
) {
  await operator.message({
    channel: "test",
    from,
    type,
    content,
    timestamp: Date.now(),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Ultimatum: basic 2-player offer/accept flow", () => {
  it("ends the game when the non-proposer accepts", async () => {
    const p1 = "inv_1";
    const p2 = "inv_2";
    const { operator } = createUltimatumWithChat("basic_accept", {
      reservationValues: [10, 20],
    });

    await operator.join(p1);
    await operator.join(p2);
    assert.equal(operator.state.gameStarted, true);

    // Player 1's turn — submit an offer
    const offer = JSON.stringify({ [p1]: 60, [p2]: 40 });
    await act(operator, p1, "submit_offer", offer);

    // Player 2's turn — accept the offer
    await act(operator, p2, "accept");

    // Game should be over with correct payoffs
    assert.equal(operator.state.gameEnded, true);
    // Player 1: utility = 60 - 10 = 50
    assert.equal(operator.state.scores[0].utility, 50);
    assert.equal(operator.state.scores[0].security, 0);
    // Player 2: utility = 40 - 20 = 20
    assert.equal(operator.state.scores[1].utility, 20);
    assert.equal(operator.state.scores[1].security, 0);
  });
});

describe("Ultimatum: rejection clears offer state", () => {
  it("clears the offer and acceptances on reject", async () => {
    const p1 = "inv_1";
    const p2 = "inv_2";
    const { operator, chat } = createUltimatumWithChat("rejection_test", {
      reservationValues: [10, 20],
    });

    await operator.join(p1);
    await operator.join(p2);

    // Player 1 proposes
    await act(operator, p1, "submit_offer", JSON.stringify({ [p1]: 90, [p2]: 10 }));

    // Player 2 rejects
    await act(operator, p2, "reject");

    // Verify the offer is cleared by checking broadcast messages
    const msgs = (await chat.challengeSync("rejection_test", p1, 0)).messages;
    assert.ok(msgs.some((m) => m.content.includes("rejected the offer")));

    // Game should NOT be over — they can keep negotiating
    assert.equal(operator.state.gameEnded, false);
  });
});

describe("Ultimatum: deadlock after max rounds", () => {
  it("ends with zero utility for everyone when rounds are exhausted", async () => {
    const p1 = "inv_1";
    const p2 = "inv_2";
    // Set maxRounds to 1 so the game ends quickly
    const { operator } = createUltimatumWithChat("deadlock_test", {
      reservationValues: [10, 20],
      maxRounds: 1,
    });

    await operator.join(p1);
    await operator.join(p2);

    // Round 1: both players pass
    await act(operator, p1, "pass");
    await act(operator, p2, "pass");

    // That exhausts round 1 → round 2 > maxRounds → deadlock
    assert.equal(operator.state.gameEnded, true);
    assert.equal(operator.state.scores[0].utility, 0);
    assert.equal(operator.state.scores[1].utility, 0);
  });
});

describe("Ultimatum: invalid offer validation", () => {
  it("rejects offers that don't sum to total", async () => {
    const p1 = "inv_1";
    const p2 = "inv_2";
    const { operator } = createUltimatumWithChat("invalid_sum", {
      reservationValues: [10, 20],
    });

    await operator.join(p1);
    await operator.join(p2);

    await assert.rejects(
      () => act(operator, p1, "submit_offer", JSON.stringify({ [p1]: 60, [p2]: 60 })),
      (err: Error) => {
        assert.match(err.message, /must equal 100/);
        return true;
      },
    );
  });

  it("rejects offers missing a player", async () => {
    const p1 = "inv_1";
    const p2 = "inv_2";
    const { operator } = createUltimatumWithChat("missing_player", {
      reservationValues: [10, 20],
    });

    await operator.join(p1);
    await operator.join(p2);

    await assert.rejects(
      () => act(operator, p1, "submit_offer", JSON.stringify({ [p1]: 100 })),
      (err: Error) => {
        assert.match(err.message, /Missing/);
        return true;
      },
    );
  });

  it("rejects offers with negative shares", async () => {
    const p1 = "inv_1";
    const p2 = "inv_2";
    const { operator } = createUltimatumWithChat("negative_share", {
      reservationValues: [10, 20],
    });

    await operator.join(p1);
    await operator.join(p2);

    await assert.rejects(
      () => act(operator, p1, "submit_offer", JSON.stringify({ [p1]: 120, [p2]: -20 })),
      (err: Error) => {
        assert.match(err.message, /negative/i);
        return true;
      },
    );
  });

  it("rejects unparseable content", async () => {
    const p1 = "inv_1";
    const p2 = "inv_2";
    const { operator } = createUltimatumWithChat("bad_json", {
      reservationValues: [10, 20],
    });

    await operator.join(p1);
    await operator.join(p2);

    await assert.rejects(
      () => act(operator, p1, "submit_offer", "give me everything"),
      (err: Error) => {
        assert.match(err.message, /Could not parse/);
        return true;
      },
    );
  });
});

describe("Ultimatum: proposer cannot accept own offer", () => {
  it("throws when the proposer tries to accept", async () => {
    const p1 = "inv_1";
    const p2 = "inv_2";
    const { operator } = createUltimatumWithChat("self_accept", {
      reservationValues: [10, 20],
      maxRounds: 10,
    });

    await operator.join(p1);
    await operator.join(p2);

    // p1 proposes
    await act(operator, p1, "submit_offer", JSON.stringify({ [p1]: 60, [p2]: 40 }));

    // Now it's p2's turn — p2 passes so it wraps back to p1
    await act(operator, p2, "pass");

    // Now p1's turn again — try to accept own offer
    await assert.rejects(
      () => act(operator, p1, "accept"),
      (err: Error) => {
        assert.match(err.message, /can't accept it yourself/);
        return true;
      },
    );
  });
});

describe("Ultimatum: turn enforcement", () => {
  it("rejects actions from the wrong player", async () => {
    const p1 = "inv_1";
    const p2 = "inv_2";
    const { operator } = createUltimatumWithChat("turn_enforce", {
      reservationValues: [10, 20],
    });

    await operator.join(p1);
    await operator.join(p2);

    // It's p1's turn — p2 tries to act
    await assert.rejects(
      () => act(operator, p2, "pass"),
      (err: Error) => {
        assert.match(err.message, /not yours/i);
        return true;
      },
    );
  });
});

describe("Ultimatum: pass advances turn", () => {
  it("moves to the next player after a pass", async () => {
    const p1 = "inv_1";
    const p2 = "inv_2";
    const { operator, chat } = createUltimatumWithChat("pass_test", {
      reservationValues: [10, 20],
      maxRounds: 10,
    });

    await operator.join(p1);
    await operator.join(p2);

    // p1 passes
    await act(operator, p1, "pass");

    // Now p2 should be able to act (submit an offer)
    const offer = JSON.stringify({ [p1]: 50, [p2]: 50 });
    await act(operator, p2, "submit_offer", offer);

    // Verify the offer went through — check broadcast messages
    const msgs = (await chat.challengeSync("pass_test", p1, 0)).messages;
    assert.ok(msgs.some((m) => m.content.includes("proposed a split")));
    assert.equal(operator.state.gameEnded, false);
  });
});

describe("Ultimatum: message_only does not advance turn", () => {
  it("allows any player to send a message without consuming their turn", async () => {
    const p1 = "inv_1";
    const p2 = "inv_2";
    const { operator } = createUltimatumWithChat("msg_only", {
      reservationValues: [10, 20],
    });

    await operator.join(p1);
    await operator.join(p2);

    // It's p1's turn. p2 sends a message_only — should not throw
    await act(operator, p2, "message_only", "Hey, let's make a fair deal");

    // p1 should still be able to act (their turn was not consumed)
    await act(operator, p1, "pass");

    // And now p2 can act
    await act(operator, p2, "pass");

    assert.equal(operator.state.gameEnded, false);
  });
});

describe("Ultimatum: 3-player unanimous consent", () => {
  it("requires all non-proposers to accept before the game ends", async () => {
    const p1 = "inv_1";
    const p2 = "inv_2";
    const p3 = "inv_3";
    const { operator } = createUltimatumWithChat("three_player", {
      players: 3,
      reservationValues: [10, 10, 10],
      maxRounds: 10,
    });

    await operator.join(p1);
    await operator.join(p2);
    await operator.join(p3);
    assert.equal(operator.state.gameStarted, true);

    // p1 proposes a 3-way split
    const offer = JSON.stringify({ [p1]: 40, [p2]: 30, [p3]: 30 });
    await act(operator, p1, "submit_offer", offer);

    // p2 accepts — game should NOT end yet (p3 hasn't accepted)
    await act(operator, p2, "accept");
    assert.equal(operator.state.gameEnded, false);

    // p3 accepts — NOW the game ends
    await act(operator, p3, "accept");
    assert.equal(operator.state.gameEnded, true);

    // Payoffs: share - reservation
    assert.equal(operator.state.scores[0].utility, 30);  // 40 - 10
    assert.equal(operator.state.scores[1].utility, 20);  // 30 - 10
    assert.equal(operator.state.scores[2].utility, 20);  // 30 - 10
  });
});

describe("Ultimatum: no offer to accept/reject", () => {
  it("throws when accepting with no offer on the table", async () => {
    const p1 = "inv_1";
    const p2 = "inv_2";
    const { operator } = createUltimatumWithChat("no_offer_accept", {
      reservationValues: [10, 20],
    });

    await operator.join(p1);
    await operator.join(p2);

    await assert.rejects(
      () => act(operator, p1, "accept"),
      (err: Error) => {
        assert.match(err.message, /no offer/i);
        return true;
      },
    );
  });

  it("throws when rejecting with no offer on the table", async () => {
    const p1 = "inv_1";
    const p2 = "inv_2";
    const { operator } = createUltimatumWithChat("no_offer_reject", {
      reservationValues: [10, 20],
    });

    await operator.join(p1);
    await operator.join(p2);

    await assert.rejects(
      () => act(operator, p1, "reject"),
      (err: Error) => {
        assert.match(err.message, /no offer/i);
        return true;
      },
    );
  });
});

describe("Ultimatum: multi-round negotiation", () => {
  it("supports reject → new offer → accept across rounds", async () => {
    const p1 = "inv_1";
    const p2 = "inv_2";
    const { operator } = createUltimatumWithChat("multi_round", {
      reservationValues: [10, 20],
      maxRounds: 10,
    });

    await operator.join(p1);
    await operator.join(p2);

    // Round 1: p1 offers 90/10, p2 rejects
    await act(operator, p1, "submit_offer", JSON.stringify({ [p1]: 90, [p2]: 10 }));
    await act(operator, p2, "reject");

    // Round 2: p1 offers 60/40, p2 accepts
    await act(operator, p1, "submit_offer", JSON.stringify({ [p1]: 60, [p2]: 40 }));
    await act(operator, p2, "accept");

    assert.equal(operator.state.gameEnded, true);
    assert.equal(operator.state.scores[0].utility, 50);  // 60 - 10
    assert.equal(operator.state.scores[1].utility, 20);  // 40 - 20
  });
});

describe("Ultimatum: reservation values are private", () => {
  it("each player only sees their own reservation value in join messages", async () => {
    const p1 = "inv_1";
    const p2 = "inv_2";
    const { operator, chat } = createUltimatumWithChat("private_rv", {
      reservationValues: [15, 25],
    });

    await operator.join(p1);
    await operator.join(p2);

    // p1's messages should mention 15 but not 25
    const sync1 = (await chat.challengeSync("private_rv", p1, 0)).messages;
    const p1Msgs = sync1.filter((m) => m.to === p1);
    const p1Text = p1Msgs.map((m) => m.content).join("\n");
    assert.ok(p1Text.includes("15"), "p1 should see their own reservation value (15)");
    assert.ok(!p1Text.includes("25"), "p1 should NOT see p2's reservation value (25)");

    // p2's messages should mention 25 but not 15
    const sync2 = (await chat.challengeSync("private_rv", p2, 0)).messages;
    const p2Msgs = sync2.filter((m) => m.to === p2);
    const p2Text = p2Msgs.map((m) => m.content).join("\n");
    assert.ok(p2Text.includes("25"), "p2 should see their own reservation value (25)");
    assert.ok(!p2Text.includes("15"), "p2 should NOT see p1's reservation value (15)");
  });
});
