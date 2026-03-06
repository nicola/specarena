import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import app from "../index";
import { defaultEngine } from "@arena/engine/engine";
import { Challenge, toChallengeChannel } from "@arena/engine/types";

const STALE_MS = 11 * 60 * 1000;

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

async function updateStoredChallenge(challengeId: string, updater: (challenge: Challenge) => void) {
  const storage = (defaultEngine as any).storageAdapter as {
    getChallenge(id: string): Promise<Challenge | undefined>;
    setChallenge(challenge: Challenge): Promise<void>;
  };
  const challenge = await storage.getChallenge(challengeId);
  assert.ok(challenge);
  updater(challenge);
  await storage.setChallenge(challenge);
}

describe("Stale challenge garbage collection", () => {
  beforeEach(async () => {
    await defaultEngine.clearRuntimeState();
  });

  it("prunes stale unstarted challenges from storage and invite lookup", async () => {
    const challenge = await createPsiChallenge();
    const instance = await defaultEngine.getChallenge(challenge.id);
    assert.ok(instance);

    await updateStoredChallenge(challenge.id, (stored) => {
      stored.createdAt = Date.now() - STALE_MS;
    });
    const removed = await defaultEngine.pruneStaleChallenges();
    assert.equal(removed, 1);

    const typed = await defaultEngine.getChallengesByType("psi");
    assert.ok(!typed.some((c) => c.id === challenge.id));

    const all = await defaultEngine.listChallenges();
    assert.ok(!all.some((c) => c.id === challenge.id));

    const invite = await defaultEngine.getChallengeFromInvite(challenge.invites[0]);
    assert.equal(invite.success, false);
  });

  it("prunes old challenges that have started but not ended", async () => {
    const challenge = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: challenge.invites[0] });
    await request("POST", "/api/arena/join", { invite: challenge.invites[1] });

    const instance = await defaultEngine.getChallenge(challenge.id);
    assert.ok(instance);
    assert.equal(instance.state.gameStarted, true);
    assert.equal(instance.state.gameEnded, false);

    await updateStoredChallenge(challenge.id, (stored) => {
      stored.createdAt = Date.now() - STALE_MS;
    });
    const removed = await defaultEngine.pruneStaleChallenges();
    assert.equal(removed, 1);

    const typed = await defaultEngine.getChallengesByType("psi");
    assert.ok(!typed.some((c) => c.id === challenge.id));
  });

  it("does not prune old challenges that have ended", async () => {
    const challenge = await createPsiChallenge();
    const instance = await defaultEngine.getChallenge(challenge.id);
    assert.ok(instance);

    await updateStoredChallenge(challenge.id, (stored) => {
      stored.state.gameEnded = true;
      stored.createdAt = Date.now() - STALE_MS;
    });
    await defaultEngine.pruneStaleChallenges();

    const typed = await defaultEngine.getChallengesByType("psi");
    assert.ok(typed.some((c) => c.id === challenge.id));
  });

  it("removes chat data for stale challenge channels", async () => {
    const challenge = await createPsiChallenge();
    const instance = await defaultEngine.getChallenge(challenge.id);
    assert.ok(instance);

    await defaultEngine.chat.sendMessage(challenge.id, "a", "public");
    await defaultEngine.chat.sendMessage(toChallengeChannel(challenge.id), "operator", "private", "a");
    await updateStoredChallenge(challenge.id, (stored) => {
      stored.createdAt = Date.now() - STALE_MS;
    });
    await defaultEngine.pruneStaleChallenges();

    const publicChannel = await defaultEngine.chat.getMessagesForChannel(challenge.id);
    const privateChannel = await defaultEngine.chat.getMessagesForChannel(toChallengeChannel(challenge.id));
    assert.equal(publicChannel.length, 0);
    assert.equal(privateChannel.length, 0);
  });
});
