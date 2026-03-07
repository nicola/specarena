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

  it("prunes old challenges that have started but not ended", async () => {
    const challenge = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: challenge.invites[0] });
    await request("POST", "/api/arena/join", { invite: challenge.invites[1] });

    const instance = await engine.getChallenge(challenge.id);
    assert.ok(instance);
    assert.equal(instance.state.gameStarted, true);
    assert.equal(instance.state.gameEnded, false);

    const removed = await engine.pruneStaleChallenges(futureNow());
    assert.equal(removed, 1);

    const { items: typed } = await engine.getChallengesByType("psi");
    assert.ok(!typed.some((c) => c.id === challenge.id));
  });

  it("does not prune old challenges that have ended", async () => {
    const challenge = await createPsiChallenge();
    await playToCompletion(challenge.id, challenge.invites);

    const ended = await engine.getChallenge(challenge.id);
    assert.ok(ended);
    assert.equal(ended.state.gameEnded, true);

    await engine.pruneStaleChallenges(futureNow());

    const { items: typed } = await engine.getChallengesByType("psi");
    assert.ok(typed.some((c) => c.id === challenge.id));
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
