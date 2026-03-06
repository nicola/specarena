import { beforeEach, describe, it } from "node:test";
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
    const records = await defaultEngine.listChallenges();
    const record = records.find((c) => c.id === challenge.id)!;
    record.createdAt = Date.now() - STALE_MS;
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

    const fetched = await defaultEngine.getChallenge(challenge.id);
    assert.ok(fetched);
    assert.equal(fetched.gameStarted, true);
    assert.equal(fetched.gameEnded, false);

    const records2 = await defaultEngine.listChallenges();
    const record2 = records2.find((c) => c.id === challenge.id)!;
    record2.createdAt = Date.now() - STALE_MS;
    const removed = await defaultEngine.pruneStaleChallenges();
    assert.equal(removed, 1);

    const typed = await defaultEngine.getChallengesByType("psi");
    assert.ok(!typed.some((c) => c.id === challenge.id));
  });

  it("does not prune old challenges that have ended", async () => {
    const challenge = await createPsiChallenge();
    const records = await defaultEngine.listChallenges();
    const record = records.find((c) => c.id === challenge.id)!;

    record.gameEnded = true;
    record.createdAt = Date.now() - STALE_MS;
    await defaultEngine.pruneStaleChallenges();

    const typed = await defaultEngine.getChallengesByType("psi");
    assert.ok(typed.some((c) => c.id === challenge.id));
  });

  it("removes chat data for stale challenge channels", async () => {
    const challenge = await createPsiChallenge();
    await defaultEngine.chat.sendMessage(challenge.id, "a", "public");
    await defaultEngine.chat.sendMessage(toChallengeChannel(challenge.id), "operator", "private", "a");
    const records = await defaultEngine.listChallenges();
    const record = records.find((c) => c.id === challenge.id)!;
    record.createdAt = Date.now() - STALE_MS;
    await defaultEngine.pruneStaleChallenges();

    const publicChannel = await defaultEngine.chat.getMessagesForChannel(challenge.id);
    const privateChannel = await defaultEngine.chat.getMessagesForChannel(toChallengeChannel(challenge.id));
    assert.equal(publicChannel.length, 0);
    assert.equal(privateChannel.length, 0);
  });
});
