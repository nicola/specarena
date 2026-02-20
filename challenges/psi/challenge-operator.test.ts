import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChatEngine, InMemoryChatStorageAdapter } from "@arena/engine/engine";
import { ChallengeFactoryContext, ChatMessage } from "@arena/engine/types";
import { createChallenge } from "./index";

function parseSet(content: string): Set<number> {
  const match = content.match(/\{(.+)\}/);
  if (!match) return new Set();
  return new Set(match[1].split(",").map((s) => parseInt(s.trim(), 10)));
}

function createPsiWithChat(challengeId: string) {
  const chat = createChatEngine({ storageAdapter: new InMemoryChatStorageAdapter() });
  const context: ChallengeFactoryContext = {
    messaging: {
      sendMessage: chat.sendMessage.bind(chat),
      sendChallengeMessage: chat.sendChallengeMessage.bind(chat),
    },
  };

  const operator = createChallenge(challengeId, undefined, context);
  return { operator, chat };
}

async function challengeSyncLike(chat: ReturnType<typeof createChatEngine>, challengeId: string, from: string, index = 0): Promise<ChatMessage[]> {
  const messages = await chat.getMessagesForChallengeChannel(challengeId);
  return messages.filter((msg) =>
    msg.index !== undefined && msg.index >= index && (!msg.to || msg.to === from || msg.from === from));
}

describe("PSI challenge with ChatEngine only", () => {
  it("runs a full game without ArenaEngine by wiring operator messaging to ChatEngine", async () => {
    const challengeId = "psi_chat_only";
    const player1 = "invite_1";
    const player2 = "invite_2";

    const { operator, chat } = createPsiWithChat(challengeId);

    await operator.join(player1);
    await operator.join(player2);
    assert.equal(operator.state.gameStarted, true);

    const sync1 = await challengeSyncLike(chat, challengeId, player1);
    const sync2 = await challengeSyncLike(chat, challengeId, player2);

    const p1SetMsg = sync1.find((m) => m.to === player1 && m.content.includes("Your private set"));
    const p2SetMsg = sync2.find((m) => m.to === player2 && m.content.includes("Your private set"));
    assert.ok(p1SetMsg);
    assert.ok(p2SetMsg);

    const p1Set = parseSet(p1SetMsg!.content);
    const p2Set = parseSet(p2SetMsg!.content);
    const intersection = [...p1Set].filter((n) => p2Set.has(n));
    assert.ok(intersection.length > 0);

    const guess = intersection.join(", ");

    await operator.message({
      channel: challengeId,
      from: player1,
      type: "guess",
      content: guess,
      timestamp: Date.now(),
    });

    await operator.message({
      channel: challengeId,
      from: player2,
      type: "guess",
      content: guess,
      timestamp: Date.now(),
    });

    assert.equal(operator.state.gameEnded, true);
    assert.equal(operator.state.scores[0].utility, 1);
    assert.equal(operator.state.scores[0].security, 1);
    assert.equal(operator.state.scores[1].utility, 1);
    assert.equal(operator.state.scores[1].security, 1);

    const publicMessages = await chat.getMessagesForChannel(challengeId);
    assert.ok(publicMessages.some((m) => m.content.includes("sent a guess")));
  });
});
