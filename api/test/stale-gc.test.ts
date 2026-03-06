import { beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";

import app from "../index";
import { defaultEngine } from "@arena/engine/engine";
import { toChallengeChannel } from "@arena/engine/types";

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

describe("Stale challenge garbage collection", () => {
  beforeEach(async () => {
    await defaultEngine.clearRuntimeState();
  });

  it("prunes stale unstarted challenges from storage and invite lookup", async () => {
    const challenge = await createPsiChallenge();
    const record = await defaultEngine.storageAdapter.getChallenge(challenge.id);
    assert.ok(record);

    await defaultEngine.storageAdapter.setChallenge({ ...record, createdAt: Date.now() - STALE_MS });
    const removed = await defaultEngine.pruneStaleChallenges();
    assert.equal(removed, 1);

    const { items: typed } = await defaultEngine.getChallengesByType("psi");
    assert.ok(!typed.some((c) => c.id === challenge.id));

    const { items: all } = await defaultEngine.listChallenges();
    assert.ok(!all.some((c) => c.id === challenge.id));

    const invite = await defaultEngine.getChallengeFromInvite(challenge.invites[0]);
    assert.equal(invite.success, false);
  });

  it("prunes old challenges that have started but not ended", async () => {
    const challenge = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: challenge.invites[0] });
    await request("POST", "/api/arena/join", { invite: challenge.invites[1] });

    const record = await defaultEngine.storageAdapter.getChallenge(challenge.id);
    assert.ok(record);
    assert.equal(record.state.gameStarted, true);
    assert.equal(record.state.gameEnded, false);

    await defaultEngine.storageAdapter.setChallenge({ ...record, createdAt: Date.now() - STALE_MS });
    const removed = await defaultEngine.pruneStaleChallenges();
    assert.equal(removed, 1);

    const { items: typed } = await defaultEngine.getChallengesByType("psi");
    assert.ok(!typed.some((c) => c.id === challenge.id));
  });

  it("does not prune old challenges that have ended", async () => {
    const challenge = await createPsiChallenge();
    const record = await defaultEngine.storageAdapter.getChallenge(challenge.id);
    assert.ok(record);

    await defaultEngine.storageAdapter.setChallenge({
      ...record,
      createdAt: Date.now() - STALE_MS,
      state: { ...record.state, gameEnded: true },
    });
    await defaultEngine.pruneStaleChallenges();

    const { items: typed } = await defaultEngine.getChallengesByType("psi");
    assert.ok(typed.some((c) => c.id === challenge.id));
  });

  it("getChallengesByType adjusts total when stale items are filtered", async () => {
    // Create 3 challenges: 2 stale, 1 fresh
    for (let i = 0; i < 3; i++) {
      const ch = await createPsiChallenge();
      if (i < 2) {
        const record = await defaultEngine.storageAdapter.getChallenge(ch.id);
        assert.ok(record);
        await defaultEngine.storageAdapter.setChallenge({ ...record, createdAt: Date.now() - STALE_MS });
      }
    }

    const { items, total } = await defaultEngine.getChallengesByType("psi");
    assert.equal(items.length, 1);
    assert.equal(total, 1);
  });

  it("removes chat data for stale challenge channels", async () => {
    const challenge = await createPsiChallenge();
    const record = await defaultEngine.storageAdapter.getChallenge(challenge.id);
    assert.ok(record);

    await defaultEngine.chat.sendMessage(challenge.id, "a", "public");
    await defaultEngine.chat.sendMessage(toChallengeChannel(challenge.id), "operator", "private", "a");
    await defaultEngine.storageAdapter.setChallenge({ ...record, createdAt: Date.now() - STALE_MS });
    await defaultEngine.pruneStaleChallenges();

    const publicChannel = await defaultEngine.chat.getMessagesForChannel(challenge.id);
    const privateChannel = await defaultEngine.chat.getMessagesForChannel(toChallengeChannel(challenge.id));
    assert.equal(publicChannel.length, 0);
    assert.equal(privateChannel.length, 0);
  });
});

describe("persistChallenge safety", () => {
  beforeEach(async () => {
    await defaultEngine.clearRuntimeState();
  });

  it("propagates storage write error during join", async () => {
    const challenge = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: challenge.invites[0] });

    // Make setChallenge throw on next call
    const originalSet = defaultEngine.storageAdapter.setChallenge.bind(defaultEngine.storageAdapter);
    defaultEngine.storageAdapter.setChallenge = mock.fn(async () => { throw new Error("storage write failed"); });

    const res = await request("POST", "/api/arena/join", { invite: challenge.invites[1] });

    // Restore original
    defaultEngine.storageAdapter.setChallenge = originalSet;

    // Storage failure surfaces as a non-200 response
    assert.notEqual(res.status, 200);
  });

  it("propagates storage write error during challengeMessage", async () => {
    const challenge = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: challenge.invites[0] });
    await request("POST", "/api/arena/join", { invite: challenge.invites[1] });

    // Make setChallenge throw
    const originalSet = defaultEngine.storageAdapter.setChallenge.bind(defaultEngine.storageAdapter);
    defaultEngine.storageAdapter.setChallenge = mock.fn(async () => { throw new Error("storage write failed"); });

    // Call engine directly to bypass identity/route issues
    const result = await defaultEngine.challengeMessage(challenge.id, "player1", "", '{"action":"reveal","item":"test"}');

    // Restore original
    defaultEngine.storageAdapter.setChallenge = originalSet;

    // challengeMessage catches the error and returns it
    assert.ok("error" in result);
  });
});
