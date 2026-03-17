import { before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { createTestAppFromEnv, type TestApp } from "./helpers/create-app";
let app: TestApp["app"];
let engine: TestApp["engine"];
import { toChallengeChannel } from "@arena/engine/types";

const STALE_MS = 11 * 60 * 1000;
const futureNow = () => Date.now() + STALE_MS;

async function request(method: string, path: string, body?: object) {
  return app.request(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function createPsiChallenge() {
  const res = await request("POST", "/api/challenges/psi");
  assert.equal(res.status, 200);
  return res.json();
}

/** Play a PSI challenge to completion (both players guess correctly). */
async function playToCompletion(challengeId: string, invites: string[]) {
  await request("POST", "/api/arena/join", { invite: invites[0] });
  await request("POST", "/api/arena/join", { invite: invites[1] });

  const challenge = await engine.getChallenge(challengeId);
  assert.ok(challenge);
  const gameState = challenge.gameState as { userSets: number[][] };
  const p1Set = new Set(gameState.userSets[0]);
  const p2Set = new Set(gameState.userSets[1]);
  const intersection = [...p1Set].filter((n) => p2Set.has(n)).join(", ");

  await engine.challengeMessage(challengeId, invites[0], "guess", intersection);
  await engine.challengeMessage(challengeId, invites[1], "guess", intersection);
}

describe("Stale challenge garbage collection", () => {
  before(async () => { ({ app, engine } = await createTestAppFromEnv()); });
  beforeEach(async () => {
    await engine.clearRuntimeState();
  });

  it("prunes stale unstarted challenges from storage and invite lookup", async () => {
    const challenge = await createPsiChallenge();

    const removed = await engine.pruneStaleChallenges(futureNow());
    assert.equal(removed, 1);

    const { items: typed } = await engine.getChallengesByType("psi");
    assert.ok(!typed.some((c) => c.id === challenge.id));

    const { items: all } = await engine.listChallenges();
    assert.ok(!all.some((c) => c.id === challenge.id));

    const invite = await engine.getChallengeFromInvite(challenge.invites[0]);
    assert.equal(invite.success, false);
  });

  it("terminates active stale challenges with default timeout scores", async () => {
    const challenge = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: challenge.invites[0] });
    await request("POST", "/api/arena/join", { invite: challenge.invites[1] });

    const instance = await engine.getChallenge(challenge.id);
    assert.ok(instance);
    assert.equal(instance.state.status, "active");

    const removed = await engine.pruneStaleChallenges(futureNow());
    assert.equal(removed, 1);

    // Challenge should still exist, now ended with timeout scores
    const { items: typed } = await engine.getChallengesByType("psi");
    const terminated = typed.find((c) => c.id === challenge.id);
    assert.ok(terminated, "terminated challenge should still be in storage");
    assert.equal(terminated.state.status, "ended");
    assert.ok(terminated.state.completedAt, "completedAt should be set");

    // Both players were unscored (0,0) so they get default timeout scores
    for (const score of terminated.state.scores) {
      assert.equal(score.security, 1, "default timeout security should be 1");
      assert.equal(score.utility, 0, "default timeout utility should be 0");
    }
  });

  it("preserves already-assigned scores on timeout termination", async () => {
    const challenge = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: challenge.invites[0] });
    await request("POST", "/api/arena/join", { invite: challenge.invites[1] });

    // Have player 0 submit a guess so they get scored
    const active = await engine.getChallenge(challenge.id);
    assert.ok(active);
    const gameState = active.gameState as { userSets: number[][] };
    const p1Set = new Set(gameState.userSets[0]);
    const p2Set = new Set(gameState.userSets[1]);
    const intersection = [...p1Set].filter((n) => p2Set.has(n)).join(", ");
    await engine.challengeMessage(challenge.id, challenge.invites[0], "guess", intersection);

    // Only player 0 has guessed; player 1 hasn't — game is still active
    const partial = await engine.getChallenge(challenge.id);
    assert.ok(partial);
    assert.equal(partial.state.status, "active");

    // Player 0 should have non-zero scores from their guess
    const p0Score = partial.state.scores[0];
    const p0Scored = p0Score.security !== 0 || p0Score.utility !== 0;

    await engine.pruneStaleChallenges(futureNow());

    const terminated = await engine.getChallenge(challenge.id);
    assert.ok(terminated);
    assert.equal(terminated.state.status, "ended");

    if (p0Scored) {
      // Player 0's scores should be preserved (not overwritten by defaults)
      assert.equal(terminated.state.scores[0].security, p0Score.security);
      assert.equal(terminated.state.scores[0].utility, p0Score.utility);
    }

    // Player 1 was unscored, so gets defaults
    assert.equal(terminated.state.scores[1].security, 1);
    assert.equal(terminated.state.scores[1].utility, 0);
  });

  it("does not prune old challenges that have ended", async () => {
    const challenge = await createPsiChallenge();
    await playToCompletion(challenge.id, challenge.invites);

    const ended = await engine.getChallenge(challenge.id);
    assert.ok(ended);
    assert.equal(ended.state.status, "ended");

    await engine.pruneStaleChallenges(futureNow());

    const { items: typed } = await engine.getChallengesByType("psi");
    assert.ok(typed.some((c) => c.id === challenge.id));
  });

  it("getChallenge lazily terminates active stale challenges instead of deleting", async () => {
    const challenge = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: challenge.invites[0] });
    await request("POST", "/api/arena/join", { invite: challenge.invites[1] });

    const active = await engine.getChallenge(challenge.id);
    assert.ok(active);
    assert.equal(active.state.status, "active");

    // Backdating createdAt so the challenge looks stale
    active.createdAt = Date.now() - STALE_MS;
    await engine.listChallenges(); // force a storage write won't work, need to set directly
    // Set the challenge in storage with old createdAt
    const storage = (engine as any).storageAdapter;
    await storage.setChallenge(active);

    // Now getChallenge should terminate (not delete) this challenge
    const result = await engine.getChallenge(challenge.id);
    assert.ok(result, "should return the terminated challenge, not undefined");
    assert.equal(result.state.status, "ended");
    for (const score of result.state.scores) {
      assert.equal(score.security, 1);
      assert.equal(score.utility, 0);
    }
  });

  it("removes chat data for stale challenge channels", async () => {
    const challenge = await createPsiChallenge();

    await engine.chat.sendMessage(challenge.id, "a", "public");
    await engine.chat.sendMessage(toChallengeChannel(challenge.id), "operator", "private", "a");
    await engine.pruneStaleChallenges(futureNow());

    const publicChannel = await engine.chat.getMessagesForChannel(challenge.id);
    const privateChannel = await engine.chat.getMessagesForChannel(toChallengeChannel(challenge.id));
    assert.equal(publicChannel.length, 0);
    assert.equal(privateChannel.length, 0);
  });
});
