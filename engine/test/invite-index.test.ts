import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { InMemoryArenaStorageAdapter } from "../storage/InMemoryArenaStorageAdapter";
import { ChallengeRecord } from "../types";

function mockChallenge(id: string, invites: string[]): ChallengeRecord {
  return {
    id,
    name: "psi",
    challengeType: "psi",
    createdAt: Date.now(),
    invites,
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
});

describe("InMemoryArenaStorageAdapter pagination", () => {
  async function seedAdapter(count: number) {
    const adapter = new InMemoryArenaStorageAdapter();
    for (let i = 0; i < count; i++) {
      await adapter.setChallenge(mockChallenge(`c${i}`, [`inv_${i}`]));
    }
    return adapter;
  }

  it("returns all items with total when no options given", async () => {
    const adapter = await seedAdapter(3);
    const result = await adapter.listChallenges();
    assert.equal(result.items.length, 3);
    assert.equal(result.total, 3);
  });

  it("applies limit", async () => {
    const adapter = await seedAdapter(5);
    const result = await adapter.listChallenges({ limit: 2 });
    assert.equal(result.items.length, 2);
    assert.equal(result.total, 5);
  });

  it("applies offset", async () => {
    const adapter = await seedAdapter(5);
    const result = await adapter.listChallenges({ offset: 3 });
    assert.equal(result.items.length, 2);
    assert.equal(result.total, 5);
  });

  it("applies limit and offset together", async () => {
    const adapter = await seedAdapter(10);
    const result = await adapter.listChallenges({ limit: 3, offset: 2 });
    assert.equal(result.items.length, 3);
    assert.equal(result.total, 10);
  });

  it("returns empty items when offset exceeds count", async () => {
    const adapter = await seedAdapter(3);
    const result = await adapter.listChallenges({ offset: 50 });
    assert.equal(result.items.length, 0);
    assert.equal(result.total, 3);
  });

  it("clamps to available items when limit exceeds remainder", async () => {
    const adapter = await seedAdapter(3);
    const result = await adapter.listChallenges({ limit: 100, offset: 1 });
    assert.equal(result.items.length, 2);
    assert.equal(result.total, 3);
  });

  it("paginates getChallengesByType", async () => {
    const adapter = new InMemoryArenaStorageAdapter();
    await adapter.setChallenge({ ...mockChallenge("c1", ["i1"]), challengeType: "psi", createdAt: 3 });
    await adapter.setChallenge({ ...mockChallenge("c2", ["i2"]), challengeType: "psi", createdAt: 2 });
    await adapter.setChallenge({ ...mockChallenge("c3", ["i3"]), challengeType: "psi", createdAt: 1 });
    await adapter.setChallenge({ ...mockChallenge("c4", ["i4"]), challengeType: "other", createdAt: 4 });

    const result = await adapter.getChallengesByType("psi", { limit: 2 });
    assert.equal(result.items.length, 2);
    assert.equal(result.total, 3);
    // sorted by createdAt desc
    assert.equal(result.items[0].id, "c1");
    assert.equal(result.items[1].id, "c2");
  });

  it("paginates getChallengesByUserId", async () => {
    const adapter = new InMemoryArenaStorageAdapter();
    for (let i = 0; i < 4; i++) {
      await adapter.setChallenge({
        ...mockChallenge(`c${i}`, [`inv_${i}`]),
        createdAt: 100 - i,
        state: {
          gameStarted: true, gameEnded: false, scores: [], players: [],
          playerIdentities: { [`inv_${i}`]: "user1" },
        },
      });
    }
    // unrelated user
    await adapter.setChallenge({
      ...mockChallenge("other", ["inv_other"]),
      createdAt: 50,
      state: {
        gameStarted: true, gameEnded: false, scores: [], players: [],
        playerIdentities: { inv_other: "user2" },
      },
    });

    const result = await adapter.getChallengesByUserId("user1", { limit: 2, offset: 1 });
    assert.equal(result.items.length, 2);
    assert.equal(result.total, 4);
    assert.equal(result.items[0].id, "c1");
    assert.equal(result.items[1].id, "c2");
  });
});
