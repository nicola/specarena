import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { InMemoryArenaStorageAdapter } from "../storage/InMemoryArenaStorageAdapter";
import { Challenge } from "../types";

function mockChallenge(id: string, invites: string[]): Challenge {
  return {
    id,
    name: "psi",
    challengeType: "psi",
    createdAt: Date.now(),
    invites,
    playerCount: 2,
    state: {
      gameStarted: false,
      gameEnded: false,
      scores: [],
      players: [],
      playerIdentities: {},
    },
  };
}

describe("InMemoryArenaStorageAdapter invite index", () => {
  it("resolves challenge by invite in O(1) index path", async () => {
    const adapter = new InMemoryArenaStorageAdapter();
    const challenge = mockChallenge("c1", ["inv_a", "inv_b"]);
    await adapter.setChallenge(challenge);

    const byInvite = await adapter.getChallengeFromInvite("inv_b");
    assert.equal(byInvite?.id, "c1");
  });

  it("updates invite index when a challenge entry is overwritten", async () => {
    const adapter = new InMemoryArenaStorageAdapter();
    await adapter.setChallenge(mockChallenge("c1", ["inv_old_a", "inv_old_b"]));
    await adapter.setChallenge(mockChallenge("c1", ["inv_new_a", "inv_new_b"]));

    const oldInvite = await adapter.getChallengeFromInvite("inv_old_a");
    const newInvite = await adapter.getChallengeFromInvite("inv_new_a");
    assert.equal(oldInvite, undefined);
    assert.equal(newInvite?.id, "c1");
  });

  it("clears invite index in clearRuntimeState", async () => {
    const adapter = new InMemoryArenaStorageAdapter();
    await adapter.setChallenge(mockChallenge("c1", ["inv_a", "inv_b"]));
    await adapter.clearRuntimeState();

    const byInvite = await adapter.getChallengeFromInvite("inv_a");
    assert.equal(byInvite, undefined);
  });

  it("returns cloned challenge records so callers cannot mutate storage by reference", async () => {
    const adapter = new InMemoryArenaStorageAdapter();
    const challenge = mockChallenge("c1", ["inv_a", "inv_b"]);
    await adapter.setChallenge(challenge);

    const loaded = await adapter.getChallenge("c1");
    assert.ok(loaded);
    loaded.createdAt = 0;
    loaded.state.players.push("inv_a");

    const reloaded = await adapter.getChallenge("c1");
    assert.ok(reloaded);
    assert.notEqual(reloaded.createdAt, 0);
    assert.deepEqual(reloaded.state.players, []);
  });
});
