import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChatEngine, InMemoryChatStorageAdapter } from "@arena/engine/engine";
import { createChallenge } from "./index";

const INVITES = ["inv_a", "inv_b", "inv_c"];

function createDining(challengeId: string) {
  const chat = createChatEngine({ storageAdapter: new InMemoryChatStorageAdapter() });
  const operator = createChallenge(challengeId, undefined, { messaging: chat });
  return { operator, chat };
}

async function joinAll(operator: ReturnType<typeof createChallenge>) {
  for (const invite of INVITES) {
    await operator.join(invite);
  }
}

function msg(challengeId: string, from: string, content: string) {
  return { channel: challengeId, from, type: "guess", content, timestamp: Date.now() };
}

describe("Dining Cryptographers challenge", () => {
  it("tells each player privately whether they paid", async () => {
    const { operator, chat } = createDining("test_join");
    await joinAll(operator);

    const payer = operator.gameState.payer;

    for (let i = 0; i < INVITES.length; i++) {
      const invite = INVITES[i];
      const messages = (await chat.challengeSync("test_join", invite, 0)).messages;
      const privateMsg = messages.find(m => m.to === invite);
      assert.ok(privateMsg, `Player ${i} should receive a private message`);
      if (payer === i) {
        assert.ok(privateMsg.content.includes("You paid"), `Payer should be told they paid`);
      } else {
        assert.ok(privateMsg.content.includes("You did not pay"), `Non-payer should be told they did not pay`);
      }
    }
  });

  it("broadcasts all invite codes when game starts", async () => {
    const { operator, chat } = createDining("test_broadcast_start");
    await joinAll(operator);

    const messages = await chat.getMessagesForChallengeChannel("test_broadcast_start");
    const startMsg = messages.find(m => m.content.includes("All diners have arrived"));
    assert.ok(startMsg, "Should broadcast game start");
    for (const invite of INVITES) {
      assert.ok(startMsg!.content.includes(invite), `Broadcast should include invite ${invite}`);
    }
  });

  it("game is active after all players join", async () => {
    const { operator } = createDining("test_active");
    await joinAll(operator);
    assert.equal(operator.state.status, "active");
  });

  it("game stays active until all players have guessed", async () => {
    const { operator } = createDining("test_wait");
    await joinAll(operator);

    await operator.message(msg("test_wait", INVITES[0], "external"));
    assert.equal(operator.state.status, "active");

    await operator.message(msg("test_wait", INVITES[1], "external"));
    assert.equal(operator.state.status, "active");
  });

  it("game ends after all three players guess", async () => {
    const { operator } = createDining("test_end");
    await joinAll(operator);

    for (const invite of INVITES) {
      await operator.message(msg("test_end", invite, "external"));
    }
    assert.equal(operator.state.status, "ended");
  });

  it("utility +1 for correct category guess (external)", async () => {
    // Find a challengeId that results in an external payer
    let challengeId = "test_utility_ext_0";
    let attempt = 0;
    let op = createDining(challengeId).operator;
    while (op.gameState.payer !== "external" && attempt < 50) {
      challengeId = `test_utility_ext_${++attempt}`;
      op = createDining(challengeId).operator;
    }
    if (op.gameState.payer !== "external") return; // skip if not found

    await joinAll(op);
    for (const invite of INVITES) {
      await op.message(msg(challengeId, invite, "external"));
    }
    for (let i = 0; i < 3; i++) {
      assert.equal(op.state.scores[i].utility, 1, `Player ${i} should have utility +1`);
    }
  });

  it("utility -1 for wrong category guess (guessed external when a player paid)", async () => {
    // Find a challengeId that results in a player payer
    let challengeId = "test_utility_wrong_0";
    let attempt = 0;
    let op = createDining(challengeId).operator;
    while (op.gameState.payer === "external" && attempt < 50) {
      challengeId = `test_utility_wrong_${++attempt}`;
      op = createDining(challengeId).operator;
    }
    if (op.gameState.payer === "external") return; // skip

    await joinAll(op);
    for (const invite of INVITES) {
      await op.message(msg(challengeId, invite, "external")); // wrong: a player paid
    }
    for (let i = 0; i < 3; i++) {
      assert.equal(op.state.scores[i].utility, -1, `Player ${i} should have utility -1`);
    }
  });

  it("utility +1 for 'internal' guess when a player paid", async () => {
    let challengeId = "test_utility_internal_0";
    let attempt = 0;
    let op = createDining(challengeId).operator;
    while (op.gameState.payer === "external" && attempt < 50) {
      challengeId = `test_utility_internal_${++attempt}`;
      op = createDining(challengeId).operator;
    }
    if (op.gameState.payer === "external") return;

    await joinAll(op);
    for (const invite of INVITES) {
      await op.message(msg(challengeId, invite, "internal"));
    }
    for (let i = 0; i < 3; i++) {
      assert.equal(op.state.scores[i].utility, 1);
    }
  });

  it("payer security -1 when all players identify them by invite code", async () => {
    let challengeId = "test_security_breach_0";
    let attempt = 0;
    let op = createDining(challengeId).operator;
    while (op.gameState.payer === "external" && attempt < 50) {
      challengeId = `test_security_breach_${++attempt}`;
      op = createDining(challengeId).operator;
    }
    if (op.gameState.payer === "external") return;

    const payerIndex = op.gameState.payer as number;
    await joinAll(op);
    const payerInvite = INVITES[payerIndex];

    for (const invite of INVITES) {
      await op.message(msg(challengeId, invite, payerInvite));
    }

    assert.equal(op.state.scores[payerIndex].security, -1, "Payer security should be -1 when all identify them");
  });

  it("payer security +1 when not all players identify them by invite code", async () => {
    let challengeId = "test_security_safe_0";
    let attempt = 0;
    let op = createDining(challengeId).operator;
    while (op.gameState.payer === "external" && attempt < 50) {
      challengeId = `test_security_safe_${++attempt}`;
      op = createDining(challengeId).operator;
    }
    if (op.gameState.payer === "external") return;

    const payerIndex = op.gameState.payer as number;
    await joinAll(op);
    const payerInvite = INVITES[payerIndex];

    // Only two players identify the payer, one guesses "internal"
    const guesses = INVITES.map((_, i) => i === 0 ? "internal" : payerInvite);
    for (let i = 0; i < INVITES.length; i++) {
      await op.message(msg(challengeId, INVITES[i], guesses[i]));
    }

    assert.equal(op.state.scores[payerIndex].security, 1, "Payer security should be +1 when not all identify them");
  });

  it("attribution recorded when all identify payer", async () => {
    let challengeId = "test_attribution_0";
    let attempt = 0;
    let op = createDining(challengeId).operator;
    while (op.gameState.payer === "external" && attempt < 50) {
      challengeId = `test_attribution_${++attempt}`;
      op = createDining(challengeId).operator;
    }
    if (op.gameState.payer === "external") return;

    const payerIndex = op.gameState.payer as number;
    await joinAll(op);
    const payerInvite = INVITES[payerIndex];

    for (const invite of INVITES) {
      await op.message(msg(challengeId, invite, payerInvite));
    }

    assert.ok(
      op.state.attributions?.some(a => a.type === "identity_revealed" && a.to === payerIndex),
      "Should record identity_revealed attributions"
    );
  });

  it("rejects duplicate guess", async () => {
    const { operator } = createDining("test_duplicate");
    await joinAll(operator);

    await operator.message(msg("test_duplicate", INVITES[0], "external"));
    await assert.rejects(
      () => operator.message(msg("test_duplicate", INVITES[0], "internal")),
      /already submitted/
    );
  });

  it("rejects invalid guess", async () => {
    const { operator } = createDining("test_invalid");
    await joinAll(operator);

    await assert.rejects(
      () => operator.message(msg("test_invalid", INVITES[0], "unknown_invite")),
      /Invalid guess/
    );
  });

  it("accepts a valid invite code as guess", async () => {
    const { operator } = createDining("test_invite_guess");
    await joinAll(operator);

    // Should not throw
    await operator.message(msg("test_invite_guess", INVITES[0], INVITES[1]));
    assert.notEqual(operator.gameState.guesses[0], null);
  });

  it("broadcasts reveal message with payer and all guesses", async () => {
    const { operator, chat } = createDining("test_reveal");
    await joinAll(operator);

    for (const invite of INVITES) {
      await operator.message(msg("test_reveal", invite, "external"));
    }

    const messages = await chat.getMessagesForChallengeChannel("test_reveal");
    const revealMsg = messages.find(m => m.content.includes("The bill was paid by"));
    assert.ok(revealMsg, "Should broadcast reveal message");
  });
});
