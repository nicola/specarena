import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import app from "../index";
import { defaultEngine } from "@arena/engine/engine";

// --- Helpers ---

async function request(method: string, path: string, body?: object) {
  return app.request(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function clearState() {
  await defaultEngine.clearRuntimeState();
}

async function createPsiChallenge() {
  const res = await request("POST", "/api/challenges/psi");
  assert.equal(res.status, 200);
  return res.json();
}

// --- Tests ---

describe("REST API for arena", () => {
  beforeEach(async () => clearState());

  it("POST /api/arena/join — joins a challenge", async () => {
    const { invites } = await createPsiChallenge();

    const res = await request("POST", "/api/arena/join", { invite: invites[0] });
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.ok(data.ChallengeID);
    assert.ok(data.ChallengeInfo);
  });

  it("POST /api/arena/join — returns 400 for missing invite", async () => {
    const res = await request("POST", "/api/arena/join", {});
    assert.equal(res.status, 400);
  });

  it("POST /api/arena/join — returns 400 for invalid invite", async () => {
    const res = await request("POST", "/api/arena/join", { invite: "inv_fake" });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  it("POST /api/arena/message — sends a guess", async () => {
    const { id, invites } = await createPsiChallenge();

    // Join both players
    await request("POST", "/api/arena/join", { invite: invites[0] });
    await request("POST", "/api/arena/join", { invite: invites[1] });

    const res = await request("POST", "/api/arena/message", {
      challengeId: id,
      from: invites[0],
      messageType: "guess",
      content: "100, 200, 300",
    });
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.ok(data.ok || data.error); // might be ok or error depending on guess validity
  });

  it("POST /api/arena/message — returns 400 for missing fields", async () => {
    const res = await request("POST", "/api/arena/message", { challengeId: "x" });
    assert.equal(res.status, 400);
  });

  it("POST /api/arena/message — returns 400 for nonexistent challenge", async () => {
    const res = await request("POST", "/api/arena/message", {
      challengeId: "nonexistent",
      from: "player",
      messageType: "guess",
      content: "1 2 3",
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes("not found"));
  });

  it("GET /api/arena/sync — returns messages", async () => {
    const { id, invites } = await createPsiChallenge();

    // Join to generate operator messages
    await request("POST", "/api/arena/join", { invite: invites[0] });

    const res = await request("GET", `/api/arena/sync?channel=${id}&from=${invites[0]}&index=0`);
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.ok(data.messages);
    assert.ok(data.count >= 1); // at least the private set message
  });

  it("GET /api/arena/sync — returns 400 for missing params", async () => {
    const res = await request("GET", "/api/arena/sync");
    assert.equal(res.status, 400);
  });

  it("POST /api/arena/join — stores userId in playerIdentities", async () => {
    const { id, invites } = await createPsiChallenge();

    await request("POST", "/api/arena/join", { invite: invites[0], userId: "user_aaa" });
    await request("POST", "/api/arena/join", { invite: invites[1], userId: "user_bbb" });

    const challenge = await defaultEngine.getChallenge(id);
    assert.ok(challenge);
    const identities = challenge.instance.state.playerIdentities;
    assert.equal(identities[invites[0]], "user_aaa");
    assert.equal(identities[invites[1]], "user_bbb");
  });

  it("POST /api/arena/join — playerIdentities is empty when no userId provided", async () => {
    const { id, invites } = await createPsiChallenge();

    await request("POST", "/api/arena/join", { invite: invites[0] });
    await request("POST", "/api/arena/join", { invite: invites[1] });

    const challenge = await defaultEngine.getChallenge(id);
    assert.ok(challenge);
    assert.deepEqual(challenge.instance.state.playerIdentities, {});
  });

  it("full game via REST API", async () => {
    // Create
    const { id, invites } = await createPsiChallenge();
    const [inv1, inv2] = invites;

    // Join
    const join1 = await (await request("POST", "/api/arena/join", { invite: inv1 })).json();
    const join2 = await (await request("POST", "/api/arena/join", { invite: inv2 })).json();
    assert.ok(join1.ChallengeID);
    assert.ok(join2.ChallengeID);

    // Sync to get private sets
    const sync1 = await (await request("GET", `/api/arena/sync?channel=${id}&from=${inv1}&index=0`)).json();
    const setMsg1 = sync1.messages.find((m: any) => m.to === inv1 && m.content.includes("Your private set"));
    assert.ok(setMsg1);

    const sync2 = await (await request("GET", `/api/arena/sync?channel=${id}&from=${inv2}&index=0`)).json();
    const setMsg2 = sync2.messages.find((m: any) => m.to === inv2 && m.content.includes("Your private set"));
    assert.ok(setMsg2);

    // Parse sets and find intersection
    const parseSet = (content: string): Set<number> => {
      const match = content.match(/\{(.+)\}/);
      if (!match) return new Set();
      return new Set(match[1].split(",").map((s) => parseInt(s.trim(), 10)));
    };
    const p1Set = parseSet(setMsg1.content);
    const p2Set = parseSet(setMsg2.content);
    const intersection = new Set([...p1Set].filter((n) => p2Set.has(n)));

    // Guess
    const guessContent = [...intersection].join(", ");
    const g1 = await (await request("POST", "/api/arena/message", {
      challengeId: id, from: inv1, messageType: "guess", content: guessContent,
    })).json();
    assert.ok(g1.ok);

    const g2 = await (await request("POST", "/api/arena/message", {
      challengeId: id, from: inv2, messageType: "guess", content: guessContent,
    })).json();
    assert.ok(g2.ok);

    // Verify game ended with perfect scores
    const instance = await defaultEngine.getChallenge(id);
    assert.ok(instance);
    assert.equal(instance.instance.state.gameEnded, true);
    assert.equal(instance.instance.state.scores[0].utility, 1);
    assert.equal(instance.instance.state.scores[1].utility, 1);
  });
});

describe("REST API for user challenges", () => {
  beforeEach(async () => clearState());

  it("GET /api/users/:userId/challenges — excludes non-ended games", async () => {
    const { id, invites } = await createPsiChallenge();
    const [inv1, inv2] = invites;

    // Join both players with known userIds
    await request("POST", "/api/arena/join", { invite: inv1, userId: "user_x" });
    await request("POST", "/api/arena/join", { invite: inv2, userId: "user_y" });

    // Game is in progress (not ended) — should NOT appear
    const res1 = await request("GET", "/api/users/user_x/challenges");
    assert.equal(res1.status, 200);
    const data1 = await res1.json();
    assert.equal(data1.total, 0);
    assert.equal(data1.challenges.length, 0);

    // Now end the game by having both players guess
    const sync1 = await (await request("GET", `/api/arena/sync?channel=${id}&from=${inv1}&index=0`)).json();
    const sync2 = await (await request("GET", `/api/arena/sync?channel=${id}&from=${inv2}&index=0`)).json();
    const parseSet = (content: string): Set<number> => {
      const match = content.match(/\{(.+)\}/);
      if (!match) return new Set();
      return new Set(match[1].split(",").map((s) => parseInt(s.trim(), 10)));
    };
    const p1Set = parseSet(sync1.messages.find((m: any) => m.to === inv1 && m.content.includes("Your private set")).content);
    const p2Set = parseSet(sync2.messages.find((m: any) => m.to === inv2 && m.content.includes("Your private set")).content);
    const intersection = [...p1Set].filter((n) => p2Set.has(n)).join(", ");

    await request("POST", "/api/arena/message", { challengeId: id, from: inv1, messageType: "guess", content: intersection });
    await request("POST", "/api/arena/message", { challengeId: id, from: inv2, messageType: "guess", content: intersection });

    // Game ended — should now appear
    const res2 = await request("GET", "/api/users/user_x/challenges");
    assert.equal(res2.status, 200);
    const data2 = await res2.json();
    assert.equal(data2.total, 1);
    assert.equal(data2.challenges[0].id, id);
  });
});

// --- Pagination helpers ---

async function finishPsiGame(userId1: string, userId2: string) {
  const { id, invites } = await createPsiChallenge();
  const [inv1, inv2] = invites;
  await request("POST", "/api/arena/join", { invite: inv1, userId: userId1 });
  await request("POST", "/api/arena/join", { invite: inv2, userId: userId2 });

  const sync1 = await (await request("GET", `/api/arena/sync?channel=${id}&from=${inv1}&index=0`)).json();
  const sync2 = await (await request("GET", `/api/arena/sync?channel=${id}&from=${inv2}&index=0`)).json();
  const parseSet = (content: string): Set<number> => {
    const match = content.match(/\{(.+)\}/);
    if (!match) return new Set();
    return new Set(match[1].split(",").map((s) => parseInt(s.trim(), 10)));
  };
  const p1Set = parseSet(sync1.messages.find((m: any) => m.to === inv1 && m.content.includes("Your private set")).content);
  const p2Set = parseSet(sync2.messages.find((m: any) => m.to === inv2 && m.content.includes("Your private set")).content);
  const intersection = [...p1Set].filter((n) => p2Set.has(n)).join(", ");

  await request("POST", "/api/arena/message", { challengeId: id, from: inv1, messageType: "guess", content: intersection });
  await request("POST", "/api/arena/message", { challengeId: id, from: inv2, messageType: "guess", content: intersection });
  return id;
}

describe("Pagination — GET /api/challenges/:name", () => {
  beforeEach(async () => clearState());

  it("returns total, limit, offset in response", async () => {
    await createPsiChallenge();
    await createPsiChallenge();

    const res = await request("GET", "/api/challenges/psi");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.total, 2);
    assert.equal(data.limit, 50);
    assert.equal(data.offset, 0);
    assert.equal(data.challenges.length, 2);
  });

  it("respects limit param", async () => {
    await createPsiChallenge();
    await createPsiChallenge();
    await createPsiChallenge();

    const res = await request("GET", "/api/challenges/psi?limit=2");
    const data = await res.json();
    assert.equal(data.total, 3);
    assert.equal(data.challenges.length, 2);
    assert.equal(data.limit, 2);
    assert.equal(data.offset, 0);
  });

  it("respects offset param", async () => {
    await createPsiChallenge();
    await createPsiChallenge();
    await createPsiChallenge();

    const res = await request("GET", "/api/challenges/psi?offset=2");
    const data = await res.json();
    assert.equal(data.total, 3);
    assert.equal(data.challenges.length, 1);
    assert.equal(data.offset, 2);
  });

  it("limit + offset slices correctly", async () => {
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const c = await createPsiChallenge();
      ids.push(c.id);
    }

    const res = await request("GET", "/api/challenges/psi?limit=2&offset=1");
    const data = await res.json();
    assert.equal(data.total, 5);
    assert.equal(data.challenges.length, 2);
    assert.equal(data.offset, 1);
    assert.equal(data.limit, 2);
    // Should be items at index 1 and 2 of the full list
    const fullRes = await request("GET", "/api/challenges/psi?limit=100");
    const fullData = await fullRes.json();
    assert.equal(data.challenges[0].id, fullData.challenges[1].id);
    assert.equal(data.challenges[1].id, fullData.challenges[2].id);
  });

  it("offset beyond total returns empty array", async () => {
    await createPsiChallenge();

    const res = await request("GET", "/api/challenges/psi?offset=100");
    const data = await res.json();
    assert.equal(data.total, 1);
    assert.equal(data.challenges.length, 0);
  });
});

describe("Pagination — GET /api/challenges", () => {
  beforeEach(async () => clearState());

  it("returns total, limit, offset in response", async () => {
    await createPsiChallenge();

    const res = await request("GET", "/api/challenges");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.total, 1);
    assert.equal(data.limit, 50);
    assert.equal(data.offset, 0);
  });

  it("respects limit and offset", async () => {
    await createPsiChallenge();
    await createPsiChallenge();
    await createPsiChallenge();

    const res = await request("GET", "/api/challenges?limit=1&offset=1");
    const data = await res.json();
    assert.equal(data.total, 3);
    assert.equal(data.challenges.length, 1);
    assert.equal(data.limit, 1);
    assert.equal(data.offset, 1);
  });
});

describe("Pagination — GET /api/users/:userId/challenges", () => {
  beforeEach(async () => clearState());

  it("returns total, limit, offset in response", async () => {
    await finishPsiGame("pg_user", "pg_opp");

    const res = await request("GET", "/api/users/pg_user/challenges");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.total, 1);
    assert.equal(data.limit, 50);
    assert.equal(data.offset, 0);
    assert.equal(data.challenges.length, 1);
  });

  it("respects limit param", async () => {
    await finishPsiGame("pg_user2", "opp_a");
    await finishPsiGame("pg_user2", "opp_b");
    await finishPsiGame("pg_user2", "opp_c");

    const res = await request("GET", "/api/users/pg_user2/challenges?limit=2");
    const data = await res.json();
    assert.equal(data.total, 3);
    assert.equal(data.challenges.length, 2);
    assert.equal(data.limit, 2);
  });

  it("respects offset param", async () => {
    await finishPsiGame("pg_user3", "opp_a");
    await finishPsiGame("pg_user3", "opp_b");
    await finishPsiGame("pg_user3", "opp_c");

    const res = await request("GET", "/api/users/pg_user3/challenges?limit=1&offset=2");
    const data = await res.json();
    assert.equal(data.total, 3);
    assert.equal(data.challenges.length, 1);
    assert.equal(data.offset, 2);
  });

  it("offset beyond total returns empty array", async () => {
    await finishPsiGame("pg_user4", "opp_a");

    const res = await request("GET", "/api/users/pg_user4/challenges?offset=50");
    const data = await res.json();
    assert.equal(data.total, 1);
    assert.equal(data.challenges.length, 0);
  });

  it("only counts ended games in total", async () => {
    // Finish one game
    await finishPsiGame("pg_user5", "opp_a");

    // Start but don't finish another
    const { invites } = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: invites[0], userId: "pg_user5" });
    await request("POST", "/api/arena/join", { invite: invites[1], userId: "opp_b" });

    const res = await request("GET", "/api/users/pg_user5/challenges");
    const data = await res.json();
    assert.equal(data.total, 1);
    assert.equal(data.challenges.length, 1);
  });
});

describe("REST API for chat", () => {
  beforeEach(async () => clearState());

  it("POST /api/chat/send — sends a message", async () => {
    const res = await request("POST", "/api/chat/send", {
      channel: "test-channel",
      from: "user1",
      content: "Hello!",
    });
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.channel, "test-channel");
    assert.equal(data.from, "user1");
    assert.equal(data.to, null);
    assert.ok(typeof data.index === "number");
  });

  it("POST /api/chat/send — sends a DM", async () => {
    const res = await request("POST", "/api/chat/send", {
      channel: "test-channel",
      from: "user1",
      to: "user2",
      content: "Secret message",
    });
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.to, "user2");
  });

  it("POST /api/chat/send — returns 400 for missing fields", async () => {
    const res = await request("POST", "/api/chat/send", { channel: "x" });
    assert.equal(res.status, 400);
  });

  it("GET /api/chat/sync — returns messages with filtering", async () => {
    // Send some messages
    await request("POST", "/api/chat/send", { channel: "ch1", from: "a", content: "broadcast" });
    await request("POST", "/api/chat/send", { channel: "ch1", from: "b", to: "a", content: "DM to A" });
    await request("POST", "/api/chat/send", { channel: "ch1", from: "b", to: "c", content: "DM to C" });

    // Sync as user A
    const res = await request("GET", "/api/chat/sync?channel=ch1&from=a&index=0");
    assert.equal(res.status, 200);

    const data = await res.json();
    // A should see: broadcast (from A), DM to A (to A), but NOT DM to C
    assert.ok(data.messages.some((m: any) => m.content === "broadcast"));
    assert.ok(data.messages.some((m: any) => m.content === "DM to A"));
    assert.ok(!data.messages.some((m: any) => m.content === "DM to C"));
  });

  it("GET /api/chat/sync — returns 400 for missing params", async () => {
    const res = await request("GET", "/api/chat/sync");
    assert.equal(res.status, 400);
  });

  it("GET /api/chat/sync — index filters older messages", async () => {
    await request("POST", "/api/chat/send", { channel: "ch2", from: "a", content: "msg1" });
    await request("POST", "/api/chat/send", { channel: "ch2", from: "a", content: "msg2" });
    await request("POST", "/api/chat/send", { channel: "ch2", from: "a", content: "msg3" });

    // Only get messages from index 3 onward
    const res = await request("GET", "/api/chat/sync?channel=ch2&from=a&index=3");
    const data = await res.json();
    assert.equal(data.count, 1);
    assert.equal(data.messages[0].content, "msg3");
  });

});
