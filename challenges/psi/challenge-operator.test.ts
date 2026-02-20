import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ChallengeFactoryContext, ChallengeMessaging, ChatMessage, ChallengeOperator } from "@arena/engine/types";
import { createChallenge } from "./index";

interface MessageCollector {
  challengeMessages: (challengeId: string) => ChatMessage[];
  publicMessages: (challengeId: string) => ChatMessage[];
}

function createMessagingCollector(): { messaging: ChallengeMessaging; collector: MessageCollector } {
  const messages: ChatMessage[] = [];
  const nextIndexByChannel: Record<string, number> = {};

  const sendMessage: ChallengeMessaging["sendMessage"] = async (channel, from, content, to) => {
    const nextIndex = (nextIndexByChannel[channel] ?? 0) + 1;
    nextIndexByChannel[channel] = nextIndex;

    const message: ChatMessage = {
      channel,
      from,
      to,
      content: content || "",
      index: nextIndex,
      timestamp: Date.now(),
    };

    messages.push(message);
    return message;
  };

  const sendChallengeMessage: ChallengeMessaging["sendChallengeMessage"] = async (challengeId, from, content, to) => {
    return sendMessage(`challenge_${challengeId}`, from, content, to);
  };

  return {
    messaging: { sendMessage, sendChallengeMessage },
    collector: {
      challengeMessages: (challengeId: string) => messages.filter((m) => m.channel === `challenge_${challengeId}`),
      publicMessages: (challengeId: string) => messages.filter((m) => m.channel === challengeId),
    },
  };
}

function createPsiOperator(challengeId: string): { operator: ChallengeOperator; collector: MessageCollector } {
  const { messaging, collector } = createMessagingCollector();
  const context: ChallengeFactoryContext = { messaging };
  const operator = createChallenge(challengeId, undefined, context);
  return { operator, collector };
}

function parseSet(content: string): Set<number> {
  const match = content.match(/\{(.+)\}/);
  if (!match) return new Set();
  return new Set(match[1].split(",").map((s) => parseInt(s.trim(), 10)));
}

function getPrivateSetMessage(collector: MessageCollector, challengeId: string, playerId: string): ChatMessage | undefined {
  return collector.challengeMessages(challengeId)
    .find((m) => m.to === playerId && m.content.includes("Your private set"));
}

async function joinBoth(operator: ChallengeOperator, p1: string, p2: string): Promise<void> {
  await operator.join(p1);
  await operator.join(p2);
}

function guessMessage(challengeId: string, from: string, content: string): ChatMessage {
  return {
    channel: challengeId,
    from,
    type: "guess",
    content,
    timestamp: Date.now(),
  };
}

describe("PSI operator (challenge-only)", () => {
  it("sends private sets on join and starts once both players join", async () => {
    const challengeId = "psi_unit_join";
    const p1 = "player_1";
    const p2 = "player_2";
    const { operator, collector } = createPsiOperator(challengeId);

    await operator.join(p1);
    assert.equal(operator.state.gameStarted, false);
    assert.ok(getPrivateSetMessage(collector, challengeId, p1));
    assert.equal(getPrivateSetMessage(collector, challengeId, p2), undefined);

    await operator.join(p2);
    assert.equal(operator.state.gameStarted, true);
    assert.ok(getPrivateSetMessage(collector, challengeId, p2));
  });

  it("exact intersection by both players ends game with perfect scores", async () => {
    const challengeId = "psi_unit_perfect";
    const p1 = "player_1";
    const p2 = "player_2";
    const { operator, collector } = createPsiOperator(challengeId);

    await joinBoth(operator, p1, p2);

    const p1Set = parseSet(getPrivateSetMessage(collector, challengeId, p1)!.content);
    const p2Set = parseSet(getPrivateSetMessage(collector, challengeId, p2)!.content);
    const intersection = [...p1Set].filter((n) => p2Set.has(n));
    const guess = intersection.join(", ");

    await operator.message(guessMessage(challengeId, p1, guess));
    assert.equal(operator.state.gameEnded, false);

    await operator.message(guessMessage(challengeId, p2, guess));
    assert.equal(operator.state.gameEnded, true);
    assert.equal(operator.state.scores[0].utility, 1);
    assert.equal(operator.state.scores[0].security, 1);
    assert.equal(operator.state.scores[1].utility, 1);
    assert.equal(operator.state.scores[1].security, 1);
    assert.equal(collector.publicMessages(challengeId).length, 2);

    const endMessage = collector.challengeMessages(challengeId)
      .find((m) => m.from === "operator" && m.content.includes("Game ended"));
    assert.ok(endMessage);
  });

  it("guessing extra elements from opponent set leaks security", async () => {
    const challengeId = "psi_unit_extra";
    const p1 = "player_1";
    const p2 = "player_2";
    const { operator, collector } = createPsiOperator(challengeId);

    await joinBoth(operator, p1, p2);

    const p1Set = parseSet(getPrivateSetMessage(collector, challengeId, p1)!.content);
    const p2Set = parseSet(getPrivateSetMessage(collector, challengeId, p2)!.content);
    const intersection = new Set([...p1Set].filter((n) => p2Set.has(n)));
    const extraFromP2 = [...p2Set].find((n) => !intersection.has(n));
    assert.ok(extraFromP2 !== undefined);

    const guess = [...intersection, extraFromP2].join(", ");
    await operator.message(guessMessage(challengeId, p1, guess));

    assert.equal(operator.state.scores[0].utility, 2);
    assert.equal(operator.state.scores[1].security, -1);
  });

  it("rejects duplicate guess from same player", async () => {
    const challengeId = "psi_unit_duplicate";
    const p1 = "player_1";
    const p2 = "player_2";
    const { operator, collector } = createPsiOperator(challengeId);

    await joinBoth(operator, p1, p2);

    const p1Set = parseSet(getPrivateSetMessage(collector, challengeId, p1)!.content);
    const p2Set = parseSet(getPrivateSetMessage(collector, challengeId, p2)!.content);
    const intersection = [...p1Set].filter((n) => p2Set.has(n));
    const guess = intersection.join(", ");

    await operator.message(guessMessage(challengeId, p1, guess));

    await assert.rejects(
      operator.message(guessMessage(challengeId, p1, guess)),
      /ERR_DUPLICATE_GUESS/
    );
  });

  it("before game start sends ERR_GAME_NOT_RUNNING and keeps scores unchanged", async () => {
    const challengeId = "psi_unit_not_started";
    const p1 = "player_1";
    const { operator, collector } = createPsiOperator(challengeId);

    await operator.join(p1);

    await operator.message(guessMessage(challengeId, p1, "100, 200, 300"));
    assert.equal(operator.state.scores[0].utility, 0);

    const notRunning = collector.challengeMessages(challengeId)
      .find((m) => m.to === p1 && m.content.includes("ERR_GAME_NOT_RUNNING"));
    assert.ok(notRunning);
  });
});
