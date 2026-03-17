import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createEngine } from "../engine";
import { ChallengeMetadata } from "../types";
import { createChallenge as createPsiChallenge } from "@arena/challenges/psi";

const PSI_METADATA: ChallengeMetadata = {
  name: "Private Set Intersection",
  description: "Test",
  players: 2,
  prompt: "PSI",
  methods: [{ name: "guess", description: "Submit your guessed intersection" }],
};

function createPsiEngine() {
  const engine = createEngine();
  engine.registerChallengeFactory("psi", createPsiChallenge);
  engine.registerChallengeMetadata("psi", PSI_METADATA);
  return engine;
}

describe("Stateless operator pattern", () => {
  it("createChallenge stores serialized gameState (arrays, not Sets)", async () => {
    const engine = createPsiEngine();
    const challenge = await engine.createChallenge("psi");

    const gs = challenge.gameState as { userSets: unknown[]; intersectionSet: unknown; guesses: unknown[] };
    assert.ok(Array.isArray(gs.userSets), "userSets should be an array");
    assert.ok(Array.isArray(gs.userSets[0]), "userSets[0] should be a plain array, not a Set");
    assert.ok(!(gs.userSets[0] instanceof Set), "userSets[0] must not be a Set");
    assert.ok(Array.isArray(gs.intersectionSet), "intersectionSet should be a plain array");
    assert.ok(!(gs.intersectionSet instanceof Set), "intersectionSet must not be a Set");
    assert.ok(Array.isArray(gs.guesses[0]), "guesses[0] should be a plain array");
  });

  it("stored gameState survives JSON round-trip", async () => {
    const engine = createPsiEngine();
    const challenge = await engine.createChallenge("psi");

    const serialized = JSON.stringify(challenge.gameState);
    const deserialized = JSON.parse(serialized);

    const gs = deserialized as { userSets: number[][]; intersectionSet: number[]; guesses: number[][] };
    assert.ok(gs.userSets.length === 2);
    assert.ok(gs.userSets[0].length > 0, "player 0 set should have elements");
    assert.ok(gs.userSets[1].length > 0, "player 1 set should have elements");
    assert.ok(gs.intersectionSet.length > 0, "intersection should have elements");
    assert.ok(gs.userSets[0].every((n) => typeof n === "number"), "all elements should be numbers");
  });

  it("operator state is not persisted until persistOperator is called", async () => {
    const engine = createPsiEngine();
    const challenge = await engine.createChallenge("psi");
    const [invite1] = challenge.invites;

    // Snapshot state before join
    const beforeJoin = await engine.getChallenge(challenge.id);
    assert.equal(beforeJoin!.state.players.length, 0);

    // Join mutates via recreate→persist
    await engine.challengeJoin(invite1);

    // State is updated in storage after persist
    const afterJoin = await engine.getChallenge(challenge.id);
    assert.equal(afterJoin!.state.players.length, 1);
    assert.equal(afterJoin!.state.players[0], invite1);
  });

  it("each request gets an independent operator — no shared mutable state", async () => {
    const engine = createPsiEngine();
    const challenge = await engine.createChallenge("psi");
    const [invite1, invite2] = challenge.invites;

    // Two sequential joins — each recreates a fresh operator
    await engine.challengeJoin(invite1);
    await engine.challengeJoin(invite2);

    const afterBothJoined = await engine.getChallenge(challenge.id);
    assert.equal(afterBothJoined!.state.players.length, 2);
    assert.equal(afterBothJoined!.state.status, "active");
    // Verify both invites are present (second join didn't lose the first)
    assert.ok(afterBothJoined!.state.players.includes(invite1));
    assert.ok(afterBothJoined!.state.players.includes(invite2));
  });

  it("game state round-trips correctly through serialize/restore across multiple actions", async () => {
    const engine = createPsiEngine();
    const challenge = await engine.createChallenge("psi");
    const [invite1, invite2] = challenge.invites;

    await engine.challengeJoin(invite1);
    await engine.challengeJoin(invite2);

    // Get the sets from operator messages
    const sync1 = await engine.challengeSync(challenge.id, invite1, 0);
    const sync2 = await engine.challengeSync(challenge.id, invite2, 0);
    const parseSet = (content: string): Set<number> => {
      const match = content.match(/\{(.+)\}/);
      if (!match) return new Set();
      return new Set(match[1].split(",").map((s) => parseInt(s.trim(), 10)));
    };
    const p1SetMsg = sync1.messages.find((m) => m.to === invite1 && m.content.includes("Your private set"));
    const p2SetMsg = sync2.messages.find((m) => m.to === invite2 && m.content.includes("Your private set"));
    const p1Set = parseSet(p1SetMsg!.content);
    const p2Set = parseSet(p2SetMsg!.content);
    const intersection = [...p1Set].filter((n) => p2Set.has(n));

    // First guess — operator is recreated, processes guess, serializes back
    const guess = intersection.join(", ");
    await engine.challengeMessage(challenge.id, invite1, "guess", guess);

    // Verify mid-game state persisted correctly
    const midGame = await engine.getChallenge(challenge.id);
    assert.equal(midGame!.state.status, "active");
    assert.equal(midGame!.state.scores[0].utility, 1);
    const midGs = midGame!.gameState as { guesses: number[][] };
    assert.ok(midGs.guesses[0].length > 0, "player 0 guess should be stored");
    assert.equal(midGs.guesses[1].length, 0, "player 1 has not guessed yet");

    // Second guess — operator is recreated again from mid-game state
    await engine.challengeMessage(challenge.id, invite2, "guess", guess);

    const endGame = await engine.getChallenge(challenge.id);
    assert.equal(endGame!.state.status, "ended");
    assert.equal(endGame!.state.scores[0].utility, 1);
    assert.equal(endGame!.state.scores[1].utility, 1);
  });

  it("challengeJoin with unregistered challenge type throws", async () => {
    const engine = createPsiEngine();
    const challenge = await engine.createChallenge("psi");

    // Corrupt the stored challenge type to simulate an unregistered type
    const stored = await engine.getChallenge(challenge.id);
    (stored as any).challengeType = "nonexistent";

    await assert.rejects(
      () => engine.challengeJoin(challenge.invites[0]),
      { message: "Unknown challenge type: nonexistent" },
    );
  });

  it("challengeMessage with non-existent challengeId returns error and sends no chat message", async () => {
    const engine = createPsiEngine();
    const fakeChallengeId = "nonexistent-challenge-id";

    const result = await engine.challengeMessage(fakeChallengeId, "player1", "guess", "hello");

    assert.deepEqual(result, { error: "Challenge not found" });

    // Verify no messages were sent on the challenge channel
    const sync = await engine.challengeSync(fakeChallengeId, null, 0);
    assert.equal(sync.messages.length, 0, "No chat messages should be sent for a non-existent challenge");
  });

  it("challengeMessage with unregistered challenge type throws", async () => {
    const engine = createPsiEngine();
    const challenge = await engine.createChallenge("psi");
    const [invite1, invite2] = challenge.invites;
    await engine.challengeJoin(invite1);
    await engine.challengeJoin(invite2);

    // Corrupt the stored challenge type
    const stored = await engine.getChallenge(challenge.id);
    (stored as any).challengeType = "nonexistent";

    await assert.rejects(
      () => engine.challengeMessage(challenge.id, invite1, "guess", "100"),
      { message: "Unknown challenge type: nonexistent" },
    );
  });
});
