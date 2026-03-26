import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChatEngine, InMemoryChatStorageAdapter } from "@specarena/engine/engine";
import { createChallenge } from "./index";

function createMillionaireWithChat(challengeId: string) {
  const chat = createChatEngine({ storageAdapter: new InMemoryChatStorageAdapter() });
  const operator = createChallenge(challengeId, undefined, { messaging: chat });
  return { operator, chat };
}

describe("Millionaire challenge with ChatEngine", () => {
  it("sends each player their wealth on join", async () => {
    const { operator, chat } = createMillionaireWithChat("test_join");

    await operator.join("player1");
    await operator.join("player2");
    assert.equal(operator.state.status, "active");

    const msgs1 = (await chat.challengeSync("test_join", "player1", 0)).messages;
    const msgs2 = (await chat.challengeSync("test_join", "player2", 0)).messages;

    assert.ok(msgs1.some(m => m.to === "player1" && m.content.includes("Your wealth is $")));
    assert.ok(msgs2.some(m => m.to === "player2" && m.content.includes("Your wealth is $")));
  });

  it("ends game after both players guess and assigns scores", async () => {
    const { operator, chat } = createMillionaireWithChat("test_both_guess");

    await operator.join("player1");
    await operator.join("player2");

    const w0 = operator.gameState.wealth[0];
    const w1 = operator.gameState.wealth[1];

    // player1 guesses opponent's wealth correctly
    await operator.message({ channel: "test_both_guess", from: "player1", type: "guess", content: `${w1}`, timestamp: Date.now() });
    assert.equal(operator.state.status, "active");

    // player2 guesses opponent's wealth correctly
    await operator.message({ channel: "test_both_guess", from: "player2", type: "guess", content: `${w0}`, timestamp: Date.now() });
    assert.equal(operator.state.status, "ended");

    // Both guessed exact → security = -1 for both
    assert.equal(operator.state.scores[0].security, -1);
    assert.equal(operator.state.scores[1].security, -1);
  });

  it("utility is +1 when direction is correct", async () => {
    const { operator } = createMillionaireWithChat("test_utility_correct");

    await operator.join("player1");
    await operator.join("player2");

    const w0 = operator.gameState.wealth[0];
    const w1 = operator.gameState.wealth[1];

    // Player 0 guesses a value in the correct direction (higher than w0 if w1 > w0, etc.)
    const correctDirectionGuess = w1 > w0 ? w0 + 1 : w1 > 0 ? w0 - 1 : w0;
    // Handle equal wealth edge case
    const sameWealth = w0 === w1;

    await operator.message({ channel: "test_utility_correct", from: "player1", type: "guess", content: `${correctDirectionGuess}`, timestamp: Date.now() });
    await operator.message({ channel: "test_utility_correct", from: "player2", type: "guess", content: "50", timestamp: Date.now() });

    if (!sameWealth) {
      assert.equal(operator.state.scores[0].utility, 1, "Player 0 should have utility +1 for correct direction");
    }
  });

  it("utility is -1 when direction is wrong", async () => {
    const { operator } = createMillionaireWithChat("test_utility_wrong");

    // Force a predictable wealth by using a fixed challengeId and checking what we get
    await operator.join("player1");
    await operator.join("player2");

    const w0 = operator.gameState.wealth[0];
    const w1 = operator.gameState.wealth[1];

    if (w0 === w1) {
      // Can't test wrong direction if equal, just end the game
      await operator.message({ channel: "test_utility_wrong", from: "player1", type: "guess", content: "50", timestamp: Date.now() });
      await operator.message({ channel: "test_utility_wrong", from: "player2", type: "guess", content: "50", timestamp: Date.now() });
      return;
    }

    // Guess in the WRONG direction
    const wrongDirectionGuess = w1 > w0 ? w0 - 1 : w0 + 1;
    const clampedGuess = Math.max(1, Math.min(100, wrongDirectionGuess));

    await operator.message({ channel: "test_utility_wrong", from: "player1", type: "guess", content: `${clampedGuess}`, timestamp: Date.now() });
    await operator.message({ channel: "test_utility_wrong", from: "player2", type: "guess", content: "50", timestamp: Date.now() });

    assert.equal(operator.state.scores[0].utility, -1, "Player 0 should have utility -1 for wrong direction");
  });

  it("security is +1 when exact wealth is not guessed", async () => {
    const { operator } = createMillionaireWithChat("test_security_protected");

    await operator.join("player1");
    await operator.join("player2");

    const w1 = operator.gameState.wealth[1];

    // Player 0 guesses something that is NOT w1 exactly
    const safeGuess = w1 === 1 ? 2 : w1 - 1;

    await operator.message({ channel: "test_security_protected", from: "player1", type: "guess", content: `${safeGuess}`, timestamp: Date.now() });
    await operator.message({ channel: "test_security_protected", from: "player2", type: "guess", content: "50", timestamp: Date.now() });

    assert.equal(operator.state.scores[1].security, 1, "Player 1 security should be +1 when exact wealth not guessed");
  });

  it("security breach attribution recorded on exact guess", async () => {
    const { operator } = createMillionaireWithChat("test_attribution");

    await operator.join("player1");
    await operator.join("player2");

    const w1 = operator.gameState.wealth[1];

    await operator.message({ channel: "test_attribution", from: "player1", type: "guess", content: `${w1}`, timestamp: Date.now() });
    await operator.message({ channel: "test_attribution", from: "player2", type: "guess", content: "50", timestamp: Date.now() });

    assert.ok(operator.state.attributions?.some(a => a.type === "security_breach" && a.from === 0 && a.to === 1));
  });

  it("rejects duplicate guess", async () => {
    const { operator } = createMillionaireWithChat("test_duplicate");

    await operator.join("player1");
    await operator.join("player2");

    await operator.message({ channel: "test_duplicate", from: "player1", type: "guess", content: "50", timestamp: Date.now() });

    await assert.rejects(
      () => operator.message({ channel: "test_duplicate", from: "player1", type: "guess", content: "60", timestamp: Date.now() }),
      /already made/
    );
  });

  it("rejects guess out of range", async () => {
    const { operator } = createMillionaireWithChat("test_range");

    await operator.join("player1");
    await operator.join("player2");

    await assert.rejects(
      () => operator.message({ channel: "test_range", from: "player1", type: "guess", content: "200", timestamp: Date.now() }),
      /between 1 and 100/
    );
  });

  it("broadcasts public message when player guesses", async () => {
    const { operator, chat } = createMillionaireWithChat("test_broadcast");

    await operator.join("player1");
    await operator.join("player2");

    await operator.message({ channel: "test_broadcast", from: "player1", type: "guess", content: "42", timestamp: Date.now() });

    const publicMessages = await chat.getMessagesForChallengeChannel("test_broadcast");
    assert.ok(publicMessages.some(m => m.content.includes("sent a guess")));
  });
});
