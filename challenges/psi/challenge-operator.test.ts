import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createChatEngine, InMemoryChatStorageAdapter } from "@arena/engine/engine";
import { createChallenge } from "./index";
import { generateRandomSetFromSeed } from "@arena/engine/utils";

function parseSet(content: string): Set<number> {
  const match = content.match(/\{(.+)\}/);
  if (!match) return new Set();
  return new Set(match[1].split(",").map((s) => parseInt(s.trim(), 10)));
}

function createPsiWithChat(challengeId: string) {
  const chat = createChatEngine({ storageAdapter: new InMemoryChatStorageAdapter() });
  const operator = createChallenge(challengeId, undefined, { messaging: chat });
  return { operator, chat };
}

describe("PSI seed privacy", () => {
  it("sets cannot be reconstructed from the public challengeId", async () => {
    const challengeId = "seed_privacy_test";
    const player1 = "invite_1";
    const player2 = "invite_2";

    const { operator, chat } = createPsiWithChat(challengeId);

    await operator.join(player1);
    await operator.join(player2);

    // Retrieve the actual sets the server dealt to both players
    const sync1 = (await chat.challengeSync(challengeId, player1, 0)).messages;
    const sync2 = (await chat.challengeSync(challengeId, player2, 0)).messages;
    const actualP1Set = parseSet(sync1.find((m) => m.to === player1)!.content);
    const actualP2Set = parseSet(sync2.find((m) => m.to === player2)!.content);

    // Attempt the old attack: reconstruct sets using the predictable seed
    const oldSeed = "challenge_" + challengeId;
    const attackIntersection = generateRandomSetFromSeed(oldSeed, 3, 100, 900);
    const attackSet0 = new Set<number>([
      ...generateRandomSetFromSeed(oldSeed + "_user_0", 10, 100, 900),
      ...attackIntersection,
    ]);
    const attackSet1 = new Set<number>([
      ...generateRandomSetFromSeed(oldSeed + "_user_1", 10, 100, 900),
      ...attackIntersection,
    ]);

    // The reconstructed sets must NOT match the real sets
    const setsMatch = (a: Set<number>, b: Set<number>) =>
      a.size === b.size && [...a].every((x) => b.has(x));

    assert.ok(
      !setsMatch(attackSet0, actualP1Set) || !setsMatch(attackSet1, actualP2Set),
      "Old predictable seed should no longer reconstruct the actual player sets"
    );
  });
});

describe("PSI challenge with ChatEngine only", () => {
  it("runs a full game without ArenaEngine by wiring operator messaging to ChatEngine", async () => {
    const challengeId = "psi_chat_only";
    const player1 = "invite_1";
    const player2 = "invite_2";

    const { operator, chat } = createPsiWithChat(challengeId);

    await operator.join(player1);
    await operator.join(player2);
    assert.equal(operator.save().gameStarted, true);

    const sync1 = (await chat.challengeSync(challengeId, player1, 0)).messages;
    const sync2 = (await chat.challengeSync(challengeId, player2, 0)).messages;

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

    const saved = operator.save();
    assert.equal(saved.gameEnded, true);
    assert.equal(saved.scores[0].utility, 1);
    assert.equal(saved.scores[0].security, 1);
    assert.equal(saved.scores[1].utility, 1);
    assert.equal(saved.scores[1].security, 1);

    const publicMessages = await chat.getMessagesForChallengeChannel(challengeId);
    assert.ok(publicMessages.some((m) => m.content.includes("sent a guess")));
  });
});
