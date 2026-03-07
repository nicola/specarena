import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChatEngine, InMemoryChatStorageAdapter } from "@arena/engine/engine";
import { createChallenge } from "./index";
import type { ChallengeOperator, Challenge } from "@arena/engine/types";

function createUltimatumWithChat(challengeId: string, options?: Record<string, unknown>) {
  const chat = createChatEngine({ storageAdapter: new InMemoryChatStorageAdapter() });
  const operator = createChallenge(challengeId, options, { messaging: chat });
  return { operator, chat };
}

function msg(channel: string, from: string, type: string, content: string = "") {
  return { channel, from, type, content, timestamp: Date.now() };
}

describe("Ultimatum challenge — basic flow", () => {
  it("runs a full 2-player game with agreement", async () => {
    const { operator, chat } = createUltimatumWithChat("ult-1", {
      reservationValues: [20, 30],
    });

    const p1 = "invite_1";
    const p2 = "invite_2";

    await operator.join(p1);
    await operator.join(p2);
    assert.equal(operator.state.gameStarted, true);

    // Verify private messages were sent
    const sync1 = (await chat.challengeSync("ult-1", p1, 0)).messages;
    const sync2 = (await chat.challengeSync("ult-1", p2, 0)).messages;
    assert.ok(sync1.some((m) => m.to === p1 && m.content.includes("20")));
    assert.ok(sync2.some((m) => m.to === p2 && m.content.includes("30")));

    // Player 1 proposes 60-40
    await operator.message(msg("ult-1", p1, "submit_offer", "60 40"));
    assert.deepEqual(operator.gameState.currentOffer, [60, 40]);
    assert.equal(operator.gameState.lastOfferBy, 0);

    // Player 2 accepts
    await operator.message(msg("ult-1", p2, "accept"));
    assert.equal(operator.state.gameEnded, true);

    // Scores: utility = (share - reservation) / total
    // P1: (60 - 20) / 100 = 0.4
    // P2: (40 - 30) / 100 = 0.1
    assert.equal(operator.state.scores[0].utility, 0.4);
    assert.equal(operator.state.scores[1].utility, 0.1);
  });

  it("ends in deadlock when max rounds are exhausted", async () => {
    const { operator } = createUltimatumWithChat("ult-deadlock", {
      maxRounds: 2,
      reservationValues: [20, 30],
    });

    const p1 = "invite_1";
    const p2 = "invite_2";

    await operator.join(p1);
    await operator.join(p2);

    // Round 1: both pass
    await operator.message(msg("ult-deadlock", p1, "pass"));
    await operator.message(msg("ult-deadlock", p2, "pass"));
    assert.equal(operator.state.gameEnded, false);

    // Round 2: both pass → deadlock
    await operator.message(msg("ult-deadlock", p1, "pass"));
    await operator.message(msg("ult-deadlock", p2, "pass"));
    assert.equal(operator.state.gameEnded, true);

    assert.equal(operator.state.scores[0].utility, 0);
    assert.equal(operator.state.scores[1].utility, 0);
  });
});

describe("Ultimatum challenge — turn enforcement", () => {
  it("rejects actions from the wrong player", async () => {
    const { operator } = createUltimatumWithChat("ult-turn", {
      reservationValues: [20, 30],
    });

    await operator.join("invite_1");
    await operator.join("invite_2");

    // It's Player 1's turn (index 0) — Player 2 cannot act
    await assert.rejects(
      () => operator.message(msg("ult-turn", "invite_2", "submit_offer", "50 50")),
      (err: any) => err.code === "NOT_YOUR_TURN",
    );
  });

  it("allows message_only from any player without consuming a turn", async () => {
    const { operator } = createUltimatumWithChat("ult-msg", {
      reservationValues: [20, 30],
    });

    await operator.join("invite_1");
    await operator.join("invite_2");

    // Player 2 sends message_only (not their turn) — should succeed
    await operator.message(msg("ult-msg", "invite_2", "message_only", "hello"));
    // Turn should not have advanced — still Player 1's turn
    assert.equal(operator.gameState.totalTurns, 0);
  });
});

describe("Ultimatum challenge — offer validation", () => {
  it("rejects offers that do not sum to total", async () => {
    const { operator } = createUltimatumWithChat("ult-sum", {
      reservationValues: [20, 30],
    });

    await operator.join("invite_1");
    await operator.join("invite_2");

    await assert.rejects(
      () => operator.message(msg("ult-sum", "invite_1", "submit_offer", "60 60")),
      (err: any) => err.code === "INVALID_OFFER_SUM",
    );
  });

  it("rejects offers with wrong number of amounts", async () => {
    const { operator } = createUltimatumWithChat("ult-count", {
      reservationValues: [20, 30],
    });

    await operator.join("invite_1");
    await operator.join("invite_2");

    await assert.rejects(
      () => operator.message(msg("ult-count", "invite_1", "submit_offer", "100")),
      (err: any) => err.code === "INVALID_OFFER",
    );
  });

  it("rejects negative amounts", async () => {
    const { operator } = createUltimatumWithChat("ult-neg", {
      reservationValues: [20, 30],
    });

    await operator.join("invite_1");
    await operator.join("invite_2");

    // parseAmounts uses \d+ so negative signs are ignored, but let's test the edge
    // Actually, \d+ won't match negatives. "120 -20" would parse as [120, 20] → sum 140 ≠ 100
    await assert.rejects(
      () => operator.message(msg("ult-neg", "invite_1", "submit_offer", "120 -20")),
      (err: any) => err.code === "INVALID_OFFER_SUM",
    );
  });
});

describe("Ultimatum challenge — accept/reject mechanics", () => {
  it("rejects accept when there is no offer", async () => {
    const { operator } = createUltimatumWithChat("ult-no-offer", {
      reservationValues: [20, 30],
    });

    await operator.join("invite_1");
    await operator.join("invite_2");

    // Player 1 tries to accept with no offer
    await assert.rejects(
      () => operator.message(msg("ult-no-offer", "invite_1", "accept")),
      (err: any) => err.code === "NO_OFFER",
    );
  });

  it("prevents proposer from accepting their own offer", async () => {
    const { operator } = createUltimatumWithChat("ult-self-accept", {
      reservationValues: [20, 30],
      maxRounds: 10,
    });

    await operator.join("invite_1");
    await operator.join("invite_2");

    // Player 1 proposes
    await operator.message(msg("ult-self-accept", "invite_1", "submit_offer", "60 40"));

    // Player 2 passes (now it's Player 1's turn again)
    await operator.message(msg("ult-self-accept", "invite_2", "pass"));

    // Player 1 tries to accept their own offer
    await assert.rejects(
      () => operator.message(msg("ult-self-accept", "invite_1", "accept")),
      (err: any) => err.code === "CANNOT_ACCEPT_OWN",
    );
  });

  it("reject clears the offer and acceptances", async () => {
    const { operator } = createUltimatumWithChat("ult-reject", {
      reservationValues: [20, 30],
    });

    await operator.join("invite_1");
    await operator.join("invite_2");

    // Player 1 proposes
    await operator.message(msg("ult-reject", "invite_1", "submit_offer", "70 30"));
    assert.ok(operator.gameState.currentOffer);

    // Player 2 rejects
    await operator.message(msg("ult-reject", "invite_2", "reject"));
    assert.equal(operator.gameState.currentOffer, null);
    assert.equal(operator.gameState.lastOfferBy, null);
    assert.ok(operator.gameState.acceptances.every((a) => !a));
  });
});

describe("Ultimatum challenge — multi-round negotiation", () => {
  it("supports counter-offers", async () => {
    const { operator } = createUltimatumWithChat("ult-counter", {
      reservationValues: [10, 10],
    });

    const p1 = "invite_1";
    const p2 = "invite_2";

    await operator.join(p1);
    await operator.join(p2);

    // P1 proposes 80-20
    await operator.message(msg("ult-counter", p1, "submit_offer", "80 20"));
    // P2 rejects
    await operator.message(msg("ult-counter", p2, "reject"));
    // P1 passes
    await operator.message(msg("ult-counter", p1, "pass"));
    // P2 counter-proposes 40-60
    await operator.message(msg("ult-counter", p2, "submit_offer", "40 60"));
    assert.deepEqual(operator.gameState.currentOffer, [40, 60]);
    assert.equal(operator.gameState.lastOfferBy, 1);

    // P1 accepts
    await operator.message(msg("ult-counter", p1, "accept"));
    assert.equal(operator.state.gameEnded, true);

    // P1: (40 - 10) / 100 = 0.3
    // P2: (60 - 10) / 100 = 0.5
    assert.equal(operator.state.scores[0].utility, 0.3);
    assert.equal(operator.state.scores[1].utility, 0.5);
  });

});

describe("Ultimatum challenge — serialize/restore", () => {
  it("round-trips through serialize/restore", async () => {
    const { operator } = createUltimatumWithChat("ult-serial", {
      reservationValues: [20, 30],
    });

    await operator.join("invite_1");
    await operator.join("invite_2");
    await operator.message(msg("ult-serial", "invite_1", "submit_offer", "60 40"));

    const serialized = operator.serialize();

    // Create fresh operator and restore
    const { operator: restored } = createUltimatumWithChat("ult-serial", {
      reservationValues: [20, 30],
    });
    restored.restore({
      id: "ult-serial",
      name: "ultimatum",
      createdAt: Date.now(),
      challengeType: "ultimatum",
      invites: ["invite_1", "invite_2"],
      ...serialized,
    } as Challenge);

    assert.equal(restored.state.gameStarted, true);
    assert.deepEqual(restored.gameState.currentOffer, [60, 40]);
    assert.equal(restored.gameState.lastOfferBy, 0);
    assert.equal(restored.gameState.totalTurns, 1);
    assert.deepEqual(restored.state.players, ["invite_1", "invite_2"]);
  });

  it("can continue playing after restore", async () => {
    const { operator } = createUltimatumWithChat("ult-continue", {
      reservationValues: [20, 30],
    });

    await operator.join("invite_1");
    await operator.join("invite_2");
    await operator.message(msg("ult-continue", "invite_1", "submit_offer", "60 40"));

    // Serialize and restore (simulates stateless operator pattern)
    const serialized = operator.serialize();
    const { operator: restored } = createUltimatumWithChat("ult-continue", {
      reservationValues: [20, 30],
    });
    restored.restore({
      id: "ult-continue",
      name: "ultimatum",
      createdAt: Date.now(),
      challengeType: "ultimatum",
      invites: ["invite_1", "invite_2"],
      ...serialized,
    } as Challenge);

    // Continue playing on the restored operator
    await restored.message(msg("ult-continue", "invite_2", "accept"));
    assert.equal(restored.state.gameEnded, true);
    assert.equal(restored.state.scores[0].utility, 0.4);
    assert.equal(restored.state.scores[1].utility, 0.1);
  });

  it("survives JSON round-trip", async () => {
    const { operator } = createUltimatumWithChat("ult-json", {
      reservationValues: [20, 30],
    });

    await operator.join("invite_1");
    await operator.join("invite_2");

    const serialized = operator.serialize();
    const fromJson = JSON.parse(JSON.stringify(serialized));

    const { operator: restored } = createUltimatumWithChat("ult-json", {
      reservationValues: [20, 30],
    });
    restored.restore({
      id: "ult-json",
      name: "ultimatum",
      createdAt: Date.now(),
      challengeType: "ultimatum",
      invites: ["invite_1", "invite_2"],
      ...fromJson,
    } as Challenge);

    assert.deepEqual(restored.gameState.reservationValues, [20, 30]);
    assert.equal(restored.gameState.total, 100);
  });
});
