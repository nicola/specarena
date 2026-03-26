import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEngine, InMemoryArenaStorageAdapter } from "@specarena/engine/engine";
import { ChallengeMetadata } from "@specarena/engine/types";
import { createChallenge } from "./index";

const PSI_METADATA: ChallengeMetadata = {
  name: "Private Set Intersection",
  description: "Find the intersection between your and your opponent's sets.",
  players: 2,
  prompt: "PSI",
  methods: [{ name: "guess", description: "Submit your guessed intersection" }],
  color: "yellow",
  icon: "intersection",
};

function createPsiEngine() {
  const engine = createEngine();
  engine.registerChallengeFactory("psi", createChallenge);
  engine.registerChallengeMetadata("psi", PSI_METADATA);
  return engine;
}

function parseSet(content: string): Set<number> {
  const match = content.match(/\{(.+)\}/);
  if (!match) return new Set();
  return new Set(match[1].split(",").map((s) => parseInt(s.trim(), 10)));
}

describe("PSI challenge with isolated engine instances", () => {
  it("runs a full game directly through engine actions", async () => {
    const engine = createPsiEngine();
    const challenge = await engine.createChallenge("psi");
    const [invite1, invite2] = challenge.invites;

    const join1 = await engine.challengeJoin(invite1);
    const join2 = await engine.challengeJoin(invite2);
    assert.equal(join1.ChallengeID, challenge.id);
    assert.equal(join2.ChallengeID, challenge.id);
    const started = await engine.getChallenge(challenge.id);
    assert.equal(started!.state.status, "active");

    const sync1 = await engine.challengeSync(challenge.id, invite1, 0);
    const sync2 = await engine.challengeSync(challenge.id, invite2, 0);
    const p1SetMsg = sync1.messages.find((m) => m.to === invite1 && m.content.includes("Your private set"));
    const p2SetMsg = sync2.messages.find((m) => m.to === invite2 && m.content.includes("Your private set"));
    assert.ok(p1SetMsg);
    assert.ok(p2SetMsg);

    const p1Set = parseSet(p1SetMsg!.content);
    const p2Set = parseSet(p2SetMsg!.content);
    const intersection = [...p1Set].filter((n) => p2Set.has(n));
    assert.ok(intersection.length > 0);

    const guess = intersection.join(", ");
    const result1 = await engine.challengeMessage(challenge.id, invite1, "guess", guess);
    const result2 = await engine.challengeMessage(challenge.id, invite2, "guess", guess);
    assert.equal(result1.ok, "Message sent");
    assert.equal(result2.ok, "Message sent");
    const ended = await engine.getChallenge(challenge.id);
    assert.equal(ended!.state.status, "ended");
    assert.equal(ended!.state.scores[0].utility, 1);
    assert.equal(ended!.state.scores[0].security, 1);
    assert.equal(ended!.state.scores[1].utility, 1);
    assert.equal(ended!.state.scores[1].security, 1);
  });

  it("keeps challenge and chat storage isolated between engine instances", async () => {
    const engineA = createPsiEngine();
    const engineB = createPsiEngine();

    const challengeA = await engineA.createChallenge("psi");
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
    engine.registerChallengeFactory("psi", createChallenge);
    engine.registerChallengeMetadata("psi", PSI_METADATA);

    const challenge = await engine.createChallenge("psi");
    await engine.challengeJoin(challenge.invites[0]);

    assert.equal((await engine.listChallenges()).items.length, 1);
    assert.ok((await engine.chat.getMessagesForChallengeChannel(challenge.id)).length > 0);
  });

});
