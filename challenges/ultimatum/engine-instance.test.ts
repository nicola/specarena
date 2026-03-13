import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEngine, InMemoryArenaStorageAdapter } from "@arena/engine/engine";
import { ChallengeMetadata } from "@arena/engine/types";
import { createChallenge } from "./index";

const ULTIMATUM_METADATA: ChallengeMetadata = {
  name: "Ultimatum Game",
  description: "Negotiate to split a fixed resource. Each player has a secret minimum acceptable share.",
  players: 2,
  prompt: "Ultimatum",
  methods: [
    { name: "submit_offer", description: "Propose a split" },
    { name: "accept", description: "Accept the current offer" },
    { name: "reject", description: "Reject the current offer" },
    { name: "pass", description: "Skip your turn" },
  ],
  color: "green",
  icon: "handshake",
};

function createUltimatumEngine(options?: Record<string, unknown>) {
  const engine = createEngine();
  engine.registerChallengeFactory("ultimatum", (id, opts, ctx) =>
    createChallenge(id, { ...options, ...opts }, ctx),
  );
  engine.registerChallengeMetadata("ultimatum", ULTIMATUM_METADATA);
  return engine;
}

describe("Ultimatum challenge with isolated engine instances", () => {
  it("creates a challenge with exactly 2 invites", async () => {
    const engine = createUltimatumEngine();
    const challenge = await engine.createChallenge("ultimatum");
    assert.equal(challenge.invites.length, 2, "Should have 2 invites for a 2-player game");
    for (const invite of challenge.invites) {
      assert.ok(invite && invite.startsWith("inv_"), `Invite should be a valid string: ${invite}`);
    }
  });

  it("runs a full game where players agree on a split", async () => {
    const engine = createUltimatumEngine({ reservationValues: [20, 30] });
    const challenge = await engine.createChallenge("ultimatum");
    const [inv0, inv1] = challenge.invites;

    // Both players join
    const join0 = await engine.challengeJoin(inv0);
    const join1 = await engine.challengeJoin(inv1);
    assert.equal(join0.ChallengeID, challenge.id);
    assert.equal(join1.ChallengeID, challenge.id);

    const started = await engine.getChallenge(challenge.id);
    assert.equal(started!.state.status, "active");

    // Each player should receive a private message with their reservation value
    const sync0 = await engine.challengeSync(challenge.id, inv0, 0);
    const sync1 = await engine.challengeSync(challenge.id, inv1, 0);
    const reservMsg0 = sync0.messages.find(
      (m) => m.to === inv0 && m.content.includes("reservation value"),
    );
    const reservMsg1 = sync1.messages.find(
      (m) => m.to === inv1 && m.content.includes("reservation value"),
    );
    assert.ok(reservMsg0, "Player 0 should receive a private reservation message");
    assert.ok(reservMsg1, "Player 1 should receive a private reservation message");

    // Player 0 proposes a 60-40 split
    const result0 = await engine.challengeMessage(challenge.id, inv0, "submit_offer", "60 40");
    assert.equal(result0.ok, "Message sent");

    // Player 1 accepts
    const result1 = await engine.challengeMessage(challenge.id, inv1, "accept", "");
    assert.equal(result1.ok, "Message sent");

    const ended = await engine.getChallenge(challenge.id);
    assert.equal(ended!.state.status, "ended");

    // P0: (60 - 20) / 100 = 0.4
    // P1: (40 - 30) / 100 = 0.1
    assert.equal(ended!.state.scores[0].utility, 0.4);
    assert.equal(ended!.state.scores[1].utility, 0.1);
  });

  it("ends in deadlock when max rounds are exhausted", async () => {
    const engine = createUltimatumEngine({ reservationValues: [20, 30], maxRounds: 2 });
    const challenge = await engine.createChallenge("ultimatum");
    const [inv0, inv1] = challenge.invites;

    await engine.challengeJoin(inv0);
    await engine.challengeJoin(inv1);

    // Both players pass twice (2 rounds)
    await engine.challengeMessage(challenge.id, inv0, "pass", "");
    await engine.challengeMessage(challenge.id, inv1, "pass", "");
    await engine.challengeMessage(challenge.id, inv0, "pass", "");
    await engine.challengeMessage(challenge.id, inv1, "pass", "");

    const ended = await engine.getChallenge(challenge.id);
    assert.equal(ended!.state.status, "ended");
    assert.equal(ended!.state.scores[0].utility, 0);
    assert.equal(ended!.state.scores[1].utility, 0);
  });

  it("private messages are visible only to the intended player", async () => {
    const engine = createUltimatumEngine({ reservationValues: [20, 30] });
    const challenge = await engine.createChallenge("ultimatum");
    const [inv0, inv1] = challenge.invites;

    await engine.challengeJoin(inv0);
    await engine.challengeJoin(inv1);

    // Player 0 syncs — should see their private message but not player 1's
    const sync0 = await engine.challengeSync(challenge.id, inv0, 0);
    const sync1 = await engine.challengeSync(challenge.id, inv1, 0);

    // The engine may include redacted placeholders; what matters is no unredacted foreign DMs
    const p0Private = sync0.messages.filter((m) => m.to && m.to !== inv0 && !m.redacted);
    const p1Private = sync1.messages.filter((m) => m.to && m.to !== inv1 && !m.redacted);

    assert.equal(p0Private.length, 0, "Player 0 should not see unredacted messages addressed to others");
    assert.equal(p1Private.length, 0, "Player 1 should not see unredacted messages addressed to others");
  });

  it("keeps challenge and chat storage isolated between engine instances", async () => {
    const engineA = createUltimatumEngine();
    const engineB = createUltimatumEngine();

    const challengeA = await engineA.createChallenge("ultimatum");
    const [inviteA] = challengeA.invites;

    assert.equal((await engineB.listChallenges()).items.length, 0);

    await engineA.challengeJoin(inviteA);
    assert.equal((await engineA.listChallenges()).items.length, 1);
    assert.equal((await engineB.listChallenges()).items.length, 0);
  });

  it("accepts injected storage adapter in createEngine()", async () => {
    const engine = createEngine({ storageAdapter: new InMemoryArenaStorageAdapter() });
    engine.registerChallengeFactory("ultimatum", (id, opts, ctx) =>
      createChallenge(id, { reservationValues: [20, 30], ...opts }, ctx),
    );
    engine.registerChallengeMetadata("ultimatum", ULTIMATUM_METADATA);

    const challenge = await engine.createChallenge("ultimatum");
    await engine.challengeJoin(challenge.invites[0]);

    assert.equal((await engine.listChallenges()).items.length, 1);
  });
});
