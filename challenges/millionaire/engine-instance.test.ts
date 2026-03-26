import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEngine, InMemoryArenaStorageAdapter } from "@specarena/engine/engine";
import { ChallengeMetadata } from "@specarena/engine/types";
import { createChallenge } from "./index";

const MILLIONAIRE_METADATA: ChallengeMetadata = {
  name: "Yao's Millionaire",
  description: "Determine who is richer without revealing your exact wealth.",
  players: 2,
  prompt: "Millionaire",
  methods: [{ name: "guess", description: "Guess your opponent's wealth in millions (1-100)" }],
  color: "green",
  icon: "dollar",
};

function createMillionaireEngine() {
  const engine = createEngine();
  engine.registerChallengeFactory("millionaire", createChallenge);
  engine.registerChallengeMetadata("millionaire", MILLIONAIRE_METADATA);
  return engine;
}

describe("Millionaire challenge with isolated engine instances", () => {
  it("creates a challenge with exactly 2 invites", async () => {
    const engine = createMillionaireEngine();
    const challenge = await engine.createChallenge("millionaire");
    assert.equal(challenge.invites.length, 2, "Should have 2 invites for a 2-player game");
    for (const invite of challenge.invites) {
      assert.ok(invite && invite.startsWith("inv_"), `Invite should be a valid string: ${invite}`);
    }
  });

  it("runs a full game through engine actions", async () => {
    const engine = createMillionaireEngine();
    const challenge = await engine.createChallenge("millionaire");
    const [inv0, inv1] = challenge.invites;

    // Both players join
    const join0 = await engine.challengeJoin(inv0);
    const join1 = await engine.challengeJoin(inv1);
    assert.equal(join0.ChallengeID, challenge.id);
    assert.equal(join1.ChallengeID, challenge.id);

    const started = await engine.getChallenge(challenge.id);
    assert.equal(started!.state.status, "active");

    // Each player gets a private message with their wealth
    const sync0 = await engine.challengeSync(challenge.id, inv0, 0);
    const sync1 = await engine.challengeSync(challenge.id, inv1, 0);
    const wealthMsg0 = sync0.messages.find((m) => m.to === inv0 && m.content.includes("Your wealth is $"));
    const wealthMsg1 = sync1.messages.find((m) => m.to === inv1 && m.content.includes("Your wealth is $"));
    assert.ok(wealthMsg0, "Player 0 should receive a private wealth message");
    assert.ok(wealthMsg1, "Player 1 should receive a private wealth message");

    // Both players guess (use 50 as a safe mid-range guess)
    const result0 = await engine.challengeMessage(challenge.id, inv0, "guess", "50");
    assert.equal(result0.ok, "Message sent");

    // Game still active after first guess
    const midGame = await engine.getChallenge(challenge.id);
    assert.equal(midGame!.state.status, "active");

    const result1 = await engine.challengeMessage(challenge.id, inv1, "guess", "50");
    assert.equal(result1.ok, "Message sent");

    // Game should be ended now
    const ended = await engine.getChallenge(challenge.id);
    assert.equal(ended!.state.status, "ended");
  });

  it("scores correctly when both players guess exactly", async () => {
    const engine = createMillionaireEngine();
    const challenge = await engine.createChallenge("millionaire");
    const [inv0, inv1] = challenge.invites;

    await engine.challengeJoin(inv0);
    await engine.challengeJoin(inv1);

    // Get actual wealth values from the challenge
    const ch = await engine.getChallenge(challenge.id);
    const w0 = (ch!.gameState as { wealth: number[] }).wealth[0];
    const w1 = (ch!.gameState as { wealth: number[] }).wealth[1];

    // Both players guess the opponent's exact wealth
    await engine.challengeMessage(challenge.id, inv0, "guess", `${w1}`);
    await engine.challengeMessage(challenge.id, inv1, "guess", `${w0}`);

    const ended = await engine.getChallenge(challenge.id);
    assert.equal(ended!.state.status, "ended");

    // Both guessed exactly → both opponents get security -1
    assert.equal(ended!.state.scores[0].security, -1);
    assert.equal(ended!.state.scores[1].security, -1);
  });

  it("scores security +1 when exact wealth is not guessed", async () => {
    const engine = createMillionaireEngine();
    const challenge = await engine.createChallenge("millionaire");
    const [inv0, inv1] = challenge.invites;

    await engine.challengeJoin(inv0);
    await engine.challengeJoin(inv1);

    const ch = await engine.getChallenge(challenge.id);
    const w1 = (ch!.gameState as { wealth: number[] }).wealth[1];

    // Player 0 guesses something close but not exact
    const safeGuess = w1 === 1 ? 2 : w1 - 1;

    await engine.challengeMessage(challenge.id, inv0, "guess", `${safeGuess}`);
    await engine.challengeMessage(challenge.id, inv1, "guess", "50");

    const ended = await engine.getChallenge(challenge.id);
    assert.equal(ended!.state.scores[1].security, 1, "Player 1 security should be +1 when exact wealth not guessed");
  });

  it("private messages are visible only to the intended player", async () => {
    const engine = createMillionaireEngine();
    const challenge = await engine.createChallenge("millionaire");
    const [inv0, inv1] = challenge.invites;

    await engine.challengeJoin(inv0);
    await engine.challengeJoin(inv1);

    const sync0 = await engine.challengeSync(challenge.id, inv0, 0);
    const sync1 = await engine.challengeSync(challenge.id, inv1, 0);

    // Player 0 should not see unredacted messages addressed to player 1 and vice versa
    // (the engine may include redacted placeholders, but the content should not be visible)
    const p0ShouldNotSee = sync0.messages.filter((m) => m.to && m.to !== inv0 && !m.redacted);
    const p1ShouldNotSee = sync1.messages.filter((m) => m.to && m.to !== inv1 && !m.redacted);

    assert.equal(p0ShouldNotSee.length, 0, "Player 0 should not see unredacted messages addressed to others");
    assert.equal(p1ShouldNotSee.length, 0, "Player 1 should not see unredacted messages addressed to others");
  });

  it("keeps challenge and chat storage isolated between engine instances", async () => {
    const engineA = createMillionaireEngine();
    const engineB = createMillionaireEngine();

    const challengeA = await engineA.createChallenge("millionaire");
    const [inviteA] = challengeA.invites;

    assert.equal((await engineB.listChallenges()).items.length, 0);
    assert.equal((await engineB.chat.getMessagesForChallengeChannel(challengeA.id)).length, 0);

    await engineA.challengeJoin(inviteA);
    assert.equal((await engineA.listChallenges()).items.length, 1);
    assert.ok((await engineA.chat.getMessagesForChallengeChannel(challengeA.id)).length > 0);
    assert.equal((await engineB.listChallenges()).items.length, 0);
    assert.equal((await engineB.chat.getMessagesForChallengeChannel(challengeA.id)).length, 0);
  });

  it("accepts injected storage adapter in createEngine()", async () => {
    const engine = createEngine({ storageAdapter: new InMemoryArenaStorageAdapter() });
    engine.registerChallengeFactory("millionaire", createChallenge);
    engine.registerChallengeMetadata("millionaire", MILLIONAIRE_METADATA);

    const challenge = await engine.createChallenge("millionaire");
    await engine.challengeJoin(challenge.invites[0]);

    assert.equal((await engine.listChallenges()).items.length, 1);
    assert.ok((await engine.chat.getMessagesForChallengeChannel(challenge.id)).length > 0);
  });
});
