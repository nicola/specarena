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

  it("finalizes stale unstarted challenges (status=ended, default scores)", async () => {
    const challenge = await createPsiChallenge();

    const removed = await engine.pruneStaleChallenges(futureNow());
    assert.equal(removed, 1);

    // Challenge is still in storage — finalized, not deleted
    const { items: typed } = await engine.getChallengesByType("psi");
    const finalized = typed.find((c) => c.id === challenge.id);
    assert.ok(finalized, "finalized challenge should still be in storage");
    assert.equal(finalized.state.status, "ended");

    // Default scores applied: utility=0, security=1 for each invite slot
    assert.equal(finalized.state.scores.length, challenge.invites.length);
    for (const score of finalized.state.scores) {
      assert.equal(score.utility, 0);
      assert.equal(score.security, 1);
    }

    // Invite lookup still works
    const invite = await engine.getChallengeFromInvite(challenge.invites[0]);
    assert.equal(invite.success, true);
  });

  it("finalizes challenges that have started but not ended", async () => {
    const challenge = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: challenge.invites[0] });
    await request("POST", "/api/arena/join", { invite: challenge.invites[1] });

    const instance = await engine.getChallenge(challenge.id);
    assert.ok(instance);
    assert.equal(instance.state.status, "active");

    const removed = await engine.pruneStaleChallenges(futureNow());
    assert.equal(removed, 1);

    // Challenge persisted as ended
    const { items: typed } = await engine.getChallengesByType("psi");
    const finalized = typed.find((c) => c.id === challenge.id);
    assert.ok(finalized, "finalized challenge should still be in storage");
    assert.equal(finalized.state.status, "ended");
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

  it("preserves chat data for finalized challenge channels", async () => {
    const challenge = await createPsiChallenge();

    await engine.chat.sendMessage(challenge.id, "a", "public");
    await engine.chat.sendMessage(toChallengeChannel(challenge.id), "operator", "private", "a");
    await engine.pruneStaleChallenges(futureNow());

    // Chat data is preserved — finalization does not delete channels
    const publicChannel = await engine.chat.getMessagesForChannel(challenge.id);
    const privateChannel = await engine.chat.getMessagesForChannel(toChallengeChannel(challenge.id));
    assert.ok(publicChannel.length > 0, "public channel messages should be preserved");
    // The private challenge channel gets the timeout broadcast message added
    assert.ok(privateChannel.length > 0, "private channel messages should be preserved");
  });
});
