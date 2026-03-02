import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEngine, InMemoryArenaStorageAdapter } from "@arena/engine/engine";
import { ChallengeMetadata } from "@arena/engine/types";
import { createChallenge } from "./index";

const ULTIMATUM_METADATA: ChallengeMetadata = {
  name: "Ultimatum Game",
  description: "Negotiate to split a fixed resource.",
  players: 2,
  prompt: "Ultimatum Game",
  methods: [
    { name: "submit_offer", description: "Propose a split" },
    { name: "accept", description: "Accept the current offer" },
    { name: "reject", description: "Reject the current offer" },
    { name: "pass", description: "Skip your turn" },
    { name: "message_only", description: "Send a message without taking an action" },
  ],
  color: "green",
  icon: "handshake",
};

/** Options with fixed reservation values so tests are deterministic */
const TEST_OPTIONS = {
  players: 2,
  reservationValues: [10, 20],
  maxRounds: 10,
};

function createUltimatumEngine(options?: Record<string, unknown>) {
  const engine = createEngine();
  engine.registerChallengeFactory("ultimatum", (id, _opts, ctx) =>
    createChallenge(id, { ...TEST_OPTIONS, ...options }, ctx),
  );
  engine.registerChallengeMetadata("ultimatum", ULTIMATUM_METADATA);
  return engine;
}

describe("Ultimatum challenge with isolated engine instances", () => {
  it("runs a full game directly through engine actions", async () => {
    const engine = createUltimatumEngine();
    const challenge = await engine.createChallenge("ultimatum");
    const [invite1, invite2] = challenge.invites;

    // Both players join
    const join1 = await engine.challengeJoin(invite1);
    const join2 = await engine.challengeJoin(invite2);
    assert.equal(join1.ChallengeID, challenge.id);
    assert.equal(join2.ChallengeID, challenge.id);
    assert.equal(challenge.instance.state.gameStarted, true);

    // Player 1 proposes a split
    const offer = JSON.stringify({ [invite1]: 60, [invite2]: 40 });
    const r1 = await engine.challengeMessage(challenge.id, invite1, "submit_offer", offer);
    assert.equal(r1.ok, "Message sent");

    // Player 2 accepts
    const r2 = await engine.challengeMessage(challenge.id, invite2, "accept", "");
    assert.equal(r2.ok, "Message sent");

    // Game should be over
    assert.equal(challenge.instance.state.gameEnded, true);
    assert.equal(challenge.instance.state.scores[0].utility, 50);  // 60 - 10
    assert.equal(challenge.instance.state.scores[1].utility, 20);  // 40 - 20
  });

  it("keeps challenge and chat storage isolated between engine instances", async () => {
    const engineA = createUltimatumEngine();
    const engineB = createUltimatumEngine();

    const challengeA = await engineA.createChallenge("ultimatum");
    const [inviteA] = challengeA.invites;

    assert.equal((await engineB.listChallenges()).length, 0);
    assert.equal((await engineB.chat.getMessagesForChallengeChannel(challengeA.id)).length, 0);

    await engineA.challengeJoin(inviteA);
    assert.equal((await engineA.listChallenges()).length, 1);
    assert.ok((await engineA.chat.getMessagesForChallengeChannel(challengeA.id)).length > 0);
    assert.equal((await engineB.listChallenges()).length, 0);
    assert.equal((await engineB.chat.getMessagesForChallengeChannel(challengeA.id)).length, 0);
  });

  it("accepts injected storage adapter in createEngine()", async () => {
    const engine = createEngine({ storageAdapter: new InMemoryArenaStorageAdapter() });
    engine.registerChallengeFactory("ultimatum", (id, _opts, ctx) =>
      createChallenge(id, TEST_OPTIONS, ctx),
    );
    engine.registerChallengeMetadata("ultimatum", ULTIMATUM_METADATA);

    const challenge = await engine.createChallenge("ultimatum");
    await engine.challengeJoin(challenge.invites[0]);

    assert.equal((await engine.listChallenges()).length, 1);
    assert.ok((await engine.chat.getMessagesForChallengeChannel(challenge.id)).length > 0);
  });
});
