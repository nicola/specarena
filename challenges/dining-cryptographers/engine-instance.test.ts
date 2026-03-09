import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "@arena/engine/engine";
import { ChallengeMetadata } from "@arena/engine/types";
import { createChallenge } from "./index";

const DINING_METADATA: ChallengeMetadata = {
  name: "Dining Cryptographers",
  description: "Three cryptographers dine together.",
  players: 3,
  prompt: "Guess who paid.",
  methods: [{ name: "guess", description: "Submit your guess." }],
  color: "purple",
  icon: "crypto",
};

function createDiningEngine() {
  const engine = createEngine();
  engine.registerChallengeFactory("dining-cryptographers", createChallenge);
  engine.registerChallengeMetadata("dining-cryptographers", DINING_METADATA);
  return engine;
}

describe("Dining Cryptographers engine-instance tests", () => {
  it("creates a challenge with exactly 3 invites", async () => {
    const engine = createDiningEngine();
    const challenge = await engine.createChallenge("dining-cryptographers");
    assert.equal(challenge.invites.length, 3, "Should have 3 invites for a 3-player game");
    for (const invite of challenge.invites) {
      assert.ok(invite && invite.startsWith("inv_"), `Invite should be a valid string: ${invite}`);
    }
  });

  it("runs a full game through engine actions", async () => {
    const engine = createDiningEngine();
    const challenge = await engine.createChallenge("dining-cryptographers");

    assert.equal(challenge.invites.length, 3);
    const [inv0, inv1, inv2] = challenge.invites;

    // All three players join
    const join0 = await engine.challengeJoin(inv0);
    const join1 = await engine.challengeJoin(inv1);
    const join2 = await engine.challengeJoin(inv2);
    assert.equal(join0.ChallengeID, challenge.id);
    assert.equal(join1.ChallengeID, challenge.id);
    assert.equal(join2.ChallengeID, challenge.id);

    const started = await engine.getChallenge(challenge.id);
    assert.equal(started!.state.status, "active");

    // Each player gets a private message about whether they paid
    for (const inv of [inv0, inv1, inv2]) {
      const sync = await engine.challengeSync(challenge.id, inv, 0);
      const privateMsg = sync.messages.find((m) => m.to === inv);
      assert.ok(privateMsg, `Player ${inv} should receive a private message`);
      assert.ok(
        privateMsg!.content.includes("You paid") || privateMsg!.content.includes("You did not pay"),
        `Private message should indicate payment status`
      );
    }

    // All three players guess "external"
    await engine.challengeMessage(challenge.id, inv0, "guess", "external");
    await engine.challengeMessage(challenge.id, inv1, "guess", "external");
    await engine.challengeMessage(challenge.id, inv2, "guess", "external");

    const ended = await engine.getChallenge(challenge.id);
    assert.equal(ended!.state.status, "ended", "Game should end after all 3 players guess");
  });

  it("allows all players to guess an invite code", async () => {
    const engine = createDiningEngine();

    // Find a challenge where a specific player (not external) paid
    let challenge = await engine.createChallenge("dining-cryptographers");
    let attempt = 0;
    while ((challenge as any).gameState?.payer === "external" && attempt < 50) {
      challenge = await engine.createChallenge("dining-cryptographers");
      attempt++;
    }
    if ((challenge as any).gameState?.payer === "external") return; // skip if unlucky

    const [inv0, inv1, inv2] = challenge.invites;
    await engine.challengeJoin(inv0);
    await engine.challengeJoin(inv1);
    await engine.challengeJoin(inv2);

    // All guess invite[0] as the payer (using invite code, not index)
    await engine.challengeMessage(challenge.id, inv0, "guess", inv0);
    await engine.challengeMessage(challenge.id, inv1, "guess", inv0);
    await engine.challengeMessage(challenge.id, inv2, "guess", inv0);

    const ended = await engine.getChallenge(challenge.id);
    assert.equal(ended!.state.status, "ended");
  });
});
