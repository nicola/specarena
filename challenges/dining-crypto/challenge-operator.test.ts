import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChatEngine, InMemoryChatStorageAdapter } from "@arena/engine/engine";
import { createChallenge } from "./index";

function createWithChat(challengeId: string) {
  const chat = createChatEngine({ storageAdapter: new InMemoryChatStorageAdapter() });
  const operator = createChallenge(challengeId, undefined, { messaging: chat });
  return { operator, chat };
}

// Compute the correct announcement for player i given the game state.
function expectedAnnouncement(
  playerIndex: number,
  payerIndex: number | null,
  coins: [number, number, number]
): number {
  // coin[left] is shared between players `left` and `playerIndex`, where left = (playerIndex+2)%3
  // coin[playerIndex] is shared between player `playerIndex` and `right = (playerIndex+1)%3`
  const leftCoin = coins[(playerIndex + 2) % 3];
  const rightCoin = coins[playerIndex];
  const xor = leftCoin ^ rightCoin;
  return playerIndex === payerIndex ? 1 - xor : xor;
}

describe("Dining Cryptographers challenge", () => {
  it("sends coin info to each player on join", async () => {
    const { operator, chat } = createWithChat("test_join");

    await operator.join("p1");
    await operator.join("p2");
    await operator.join("p3");
    assert.equal(operator.state.status, "active");

    for (const [pid, label] of [["p1", "Cryptographer 1"], ["p2", "Cryptographer 2"], ["p3", "Cryptographer 3"]]) {
      const msgs = (await chat.challengeSync("test_join", pid, 0)).messages;
      const privateMsg = msgs.find((m) => m.to === pid);
      assert.ok(privateMsg, `${pid} should receive a private message`);
      assert.ok(privateMsg!.content.includes(label));
      assert.ok(privateMsg!.content.includes("coin"));
    }
  });

  it("protocol succeeds when all players announce correctly", async () => {
    const { operator } = createWithChat("test_correct");

    await operator.join("p1");
    await operator.join("p2");
    await operator.join("p3");

    const { coins, payerIndex } = operator.gameState;

    for (let i = 0; i < 3; i++) {
      const value = expectedAnnouncement(i, payerIndex, coins);
      await operator.message({
        channel: "test_correct",
        from: `p${i + 1}`,
        type: "announce",
        content: `${value}`,
        timestamp: Date.now(),
      });
    }

    assert.equal(operator.state.status, "ended");
    assert.equal(operator.state.scores[0].utility, 1);
    assert.equal(operator.state.scores[1].utility, 1);
    assert.equal(operator.state.scores[2].utility, 1);
    assert.equal(operator.state.scores[0].security, 1);
    assert.equal(operator.state.scores[1].security, 1);
    assert.equal(operator.state.scores[2].security, 1);
  });

  it("xor of all correct announcements equals 1 when internal payer, 0 when external", async () => {
    // Run many challenges and verify the XOR invariant holds for all payer combinations.
    for (let trial = 0; trial < 20; trial++) {
      const { operator } = createWithChat(`test_xor_${trial}`);
      await operator.join("p1");
      await operator.join("p2");
      await operator.join("p3");

      const { coins, payerIndex } = operator.gameState;
      const announcements = [0, 1, 2].map((i) => expectedAnnouncement(i, payerIndex, coins));
      const xor = announcements[0] ^ announcements[1] ^ announcements[2];

      if (payerIndex !== null) {
        assert.equal(xor, 1, `trial ${trial}: expected XOR=1 for internal payer ${payerIndex}`);
      } else {
        assert.equal(xor, 0, `trial ${trial}: expected XOR=0 for external payer`);
      }
    }
  });

  it("non-payer deviating causes utility=-1 and their security=-1", async () => {
    // Find a challenge where player 0 is NOT the payer, then have player 0 flip their announcement.
    let found = false;
    for (let trial = 0; trial < 50 && !found; trial++) {
      const { operator } = createWithChat(`test_deviate_${trial}`);
      await operator.join("p1");
      await operator.join("p2");
      await operator.join("p3");

      const { coins, payerIndex } = operator.gameState;

      // Only test when player 0 is NOT the payer.
      if (payerIndex === 0) continue;
      found = true;

      const correctVal = expectedAnnouncement(0, payerIndex, coins);
      const wrongVal = 1 - correctVal; // flip it

      await operator.message({ channel: `test_deviate_${trial}`, from: "p1", type: "announce", content: `${wrongVal}`, timestamp: Date.now() });
      await operator.message({ channel: `test_deviate_${trial}`, from: "p2", type: "announce", content: `${expectedAnnouncement(1, payerIndex, coins)}`, timestamp: Date.now() });
      await operator.message({ channel: `test_deviate_${trial}`, from: "p3", type: "announce", content: `${expectedAnnouncement(2, payerIndex, coins)}`, timestamp: Date.now() });

      assert.equal(operator.state.scores[0].utility, -1, "Deviating player 0 should have utility=-1");
      assert.equal(operator.state.scores[0].security, -1, "Deviating player 0 should have security=-1");

      // Security breach attribution: from player 0 (deviator) to payer
      if (payerIndex !== null) {
        assert.ok(
          operator.state.attributions?.some((a) => a.from === 0 && a.to === payerIndex && a.type === "security_breach"),
          "Should record security_breach attribution"
        );
      }
    }
    assert.ok(found, "Should find a trial where player 0 is not the payer");
  });

  it("rejects duplicate announcement", async () => {
    const { operator } = createWithChat("test_duplicate");
    await operator.join("p1");
    await operator.join("p2");
    await operator.join("p3");

    await operator.message({ channel: "test_duplicate", from: "p1", type: "announce", content: "0", timestamp: Date.now() });

    await assert.rejects(
      () => operator.message({ channel: "test_duplicate", from: "p1", type: "announce", content: "1", timestamp: Date.now() }),
      /Already announced/
    );
  });

  it("rejects invalid announcement value", async () => {
    const { operator } = createWithChat("test_invalid");
    await operator.join("p1");
    await operator.join("p2");
    await operator.join("p3");

    await assert.rejects(
      () => operator.message({ channel: "test_invalid", from: "p1", type: "announce", content: "hello", timestamp: Date.now() }),
      /Invalid announcement/
    );
  });

  it("broadcasts public result message when game ends", async () => {
    const { operator, chat } = createWithChat("test_broadcast");
    await operator.join("p1");
    await operator.join("p2");
    await operator.join("p3");

    const { coins, payerIndex } = operator.gameState;
    for (let i = 0; i < 3; i++) {
      await operator.message({
        channel: "test_broadcast", from: `p${i + 1}`, type: "announce",
        content: `${expectedAnnouncement(i, payerIndex, coins)}`, timestamp: Date.now(),
      });
    }

    const publicMsgs = await chat.getMessagesForChallengeChannel("test_broadcast");
    assert.ok(publicMsgs.some((m) => m.content.includes("Result:")));
  });
});
