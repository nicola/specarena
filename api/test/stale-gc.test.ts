import { before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { createTestAppFromEnv, type TestApp } from "./helpers/create-app";
let app: TestApp["app"];
let engine: TestApp["engine"];
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
  before(async () => { ({ app, engine } = await createTestAppFromEnv()); });
  beforeEach(async () => {
    await engine.clearRuntimeState();
  });

  it("prunes stale unstarted challenges from storage and invite lookup", async () => {
    const challenge = await createPsiChallenge();
    const instance = await engine.getChallenge(challenge.id);
    assert.ok(instance);

    instance.createdAt = Date.now() - STALE_MS;
    await engine.updateChallenge(instance);
    const removed = await engine.pruneStaleChallenges();
    assert.equal(removed, 1);

    const typed = await engine.getChallengesByType("psi");
    assert.ok(!typed.some((c) => c.id === challenge.id));

    const all = await engine.listChallenges();
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

    instance.createdAt = Date.now() - STALE_MS;
    await engine.updateChallenge(instance);
    const removed = await engine.pruneStaleChallenges();
    assert.equal(removed, 1);

    const typed = await engine.getChallengesByType("psi");
    assert.ok(!typed.some((c) => c.id === challenge.id));
  });

  it("does not prune old challenges that have ended", async () => {
    const challenge = await createPsiChallenge();
    const instance = await engine.getChallenge(challenge.id);
    assert.ok(instance);

    instance.state.gameEnded = true;
    instance.createdAt = Date.now() - STALE_MS;
    await engine.updateChallenge(instance);
    await engine.pruneStaleChallenges();

    const typed = await engine.getChallengesByType("psi");
    assert.ok(typed.some((c) => c.id === challenge.id));
  });

  it("removes chat data for stale challenge channels", async () => {
    const challenge = await createPsiChallenge();
    const instance = await engine.getChallenge(challenge.id);
    assert.ok(instance);

    await engine.chat.sendMessage(challenge.id, "a", "public");
    await engine.chat.sendMessage(toChallengeChannel(challenge.id), "operator", "private", "a");
    instance.createdAt = Date.now() - STALE_MS;
    await engine.updateChallenge(instance);
    await engine.pruneStaleChallenges();

    const publicChannel = await engine.chat.getMessagesForChannel(challenge.id);
    const privateChannel = await engine.chat.getMessagesForChannel(toChallengeChannel(challenge.id));
    assert.equal(publicChannel.length, 0);
    assert.equal(privateChannel.length, 0);
  });
});
