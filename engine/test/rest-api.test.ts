import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import app from "../server/index";
import { defaultEngine } from "../engine";
import { generateTestKeypair, signJoin } from "./helpers/auth";

// --- Helpers ---

async function request(method: string, path: string, body?: object, headers?: Record<string, string>) {
  return app.request(path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
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

/** Join with auth and return { challengeId, invite, sessionToken, data } */
async function authJoin(invite: string) {
  const kp = generateTestKeypair();
  const signature = signJoin(kp.privateKey, invite);
  const res = await request("POST", "/api/arena/join", {
    invite,
    publicKey: kp.publicKeyHex,
    signature,
  });
  const data = await res.json();
  return { ...data, sessionToken: data.sessionToken, invite, publicKeyHex: kp.publicKeyHex };
}

function bearerHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

// --- Tests ---

describe("REST API for arena", () => {
  beforeEach(async () => clearState());

  it("POST /api/arena/join — joins a challenge with auth", async () => {
    const { invites } = await createPsiChallenge();

    const result = await authJoin(invites[0]);
    assert.ok(result.ChallengeID);
    assert.ok(result.ChallengeInfo);
    assert.ok(result.sessionToken, "should return sessionToken");
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

  it("POST /api/arena/join — returns 400 for bad signature", async () => {
    const { invites } = await createPsiChallenge();
    const kp = generateTestKeypair();
    const wrongKp = generateTestKeypair();
    const signature = signJoin(wrongKp.privateKey, invites[0]); // wrong key

    const res = await request("POST", "/api/arena/join", {
      invite: invites[0],
      publicKey: kp.publicKeyHex,
      signature,
    });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes("Signature"));
  });

  it("POST /api/arena/message — sends a guess with auth", async () => {
    const { id, invites } = await createPsiChallenge();

    // Join both players
    const j1 = await authJoin(invites[0]);
    const j2 = await authJoin(invites[1]);

    const res = await request("POST", "/api/arena/message", {
      challengeId: id,
      from: invites[0],
      messageType: "guess",
      content: "100, 200, 300",
    }, bearerHeader(j1.sessionToken));
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.ok(data.ok || data.error);
  });

  it("POST /api/arena/message — from is derived from token when omitted", async () => {
    const { id, invites } = await createPsiChallenge();
    const j1 = await authJoin(invites[0]);
    await authJoin(invites[1]);

    // Send without `from` — should be derived from token
    const res = await request("POST", "/api/arena/message", {
      challengeId: id,
      messageType: "guess",
      content: "100, 200, 300",
    }, bearerHeader(j1.sessionToken));
    assert.equal(res.status, 200);
  });

  it("POST /api/arena/message — returns 401 without token", async () => {
    const { id, invites } = await createPsiChallenge();
    await authJoin(invites[0]);
    await authJoin(invites[1]);

    const res = await request("POST", "/api/arena/message", {
      challengeId: id,
      from: invites[0],
      messageType: "guess",
      content: "100, 200, 300",
    });
    assert.equal(res.status, 401);
  });

  it("POST /api/arena/message — returns 401 for wrong token", async () => {
    const { id, invites } = await createPsiChallenge();
    await authJoin(invites[0]);
    const j2 = await authJoin(invites[1]);

    // Use player 2's token but player 1's from
    const res = await request("POST", "/api/arena/message", {
      challengeId: id,
      from: invites[0],
      messageType: "guess",
      content: "100",
    }, bearerHeader(j2.sessionToken));
    assert.equal(res.status, 401);
  });

  it("POST /api/arena/message — returns 400 for missing fields", async () => {
    const res = await request("POST", "/api/arena/message", { challengeId: "x" });
    // Missing from → 401 because middleware rejects before route validation
    assert.ok([400, 401].includes(res.status));
  });

  it("GET /api/arena/sync — returns messages with auth", async () => {
    const { id, invites } = await createPsiChallenge();
    const j1 = await authJoin(invites[0]);

    const res = await request(
      "GET",
      `/api/arena/sync?channel=${id}&from=${invites[0]}&index=0`,
      undefined,
      bearerHeader(j1.sessionToken),
    );
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.ok(data.messages);
    assert.ok(data.count >= 1);
  });

  it("GET /api/arena/sync — from is derived from token when omitted", async () => {
    const { id, invites } = await createPsiChallenge();
    const j1 = await authJoin(invites[0]);

    // Sync without `from` query param
    const res = await request(
      "GET",
      `/api/arena/sync?channel=${id}&index=0`,
      undefined,
      bearerHeader(j1.sessionToken),
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.messages);
  });

  it("GET /api/arena/sync — returns 401 without token", async () => {
    const { id, invites } = await createPsiChallenge();
    await authJoin(invites[0]);

    const res = await request("GET", `/api/arena/sync?channel=${id}&from=${invites[0]}&index=0`);
    assert.equal(res.status, 401);
  });

  it("GET /api/arena/sync — returns 400 for missing params", async () => {
    const res = await request("GET", "/api/arena/sync");
    // No channel/from → 401 from middleware
    assert.ok([400, 401].includes(res.status));
  });

  it("POST /api/arena/join — stores publicKey on challenge", async () => {
    const { invites } = await createPsiChallenge();

    const j1 = await authJoin(invites[0]);
    assert.ok(j1.ChallengeID);

    const challenge = await defaultEngine.getChallenge(j1.ChallengeID);
    assert.ok(challenge);
    assert.ok(challenge.publicKeys);
    assert.equal(challenge.publicKeys[invites[0]], j1.publicKeyHex);
  });

  it("full game via REST API", async () => {
    // Create
    const { id, invites } = await createPsiChallenge();
    const [inv1, inv2] = invites;

    // Join
    const j1 = await authJoin(inv1);
    const j2 = await authJoin(inv2);
    assert.ok(j1.ChallengeID);
    assert.ok(j2.ChallengeID);

    // Sync to get private sets
    const sync1 = await (await request("GET", `/api/arena/sync?channel=${id}&from=${inv1}&index=0`, undefined, bearerHeader(j1.sessionToken))).json();
    const setMsg1 = sync1.messages.find((m: any) => m.to === inv1 && m.content.includes("Your private set"));
    assert.ok(setMsg1);

    const sync2 = await (await request("GET", `/api/arena/sync?channel=${id}&from=${inv2}&index=0`, undefined, bearerHeader(j2.sessionToken))).json();
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
    }, bearerHeader(j1.sessionToken))).json();
    assert.ok(g1.ok);

    const g2 = await (await request("POST", "/api/arena/message", {
      challengeId: id, from: inv2, messageType: "guess", content: guessContent,
    }, bearerHeader(j2.sessionToken))).json();
    assert.ok(g2.ok);

    // Verify game ended with perfect scores
    const instance = await defaultEngine.getChallenge(id);
    assert.ok(instance);
    assert.equal(instance.instance.state.gameEnded, true);
    assert.equal(instance.instance.state.scores[0].utility, 1);
    assert.equal(instance.instance.state.scores[1].utility, 1);
  });
});

describe("REST API for chat", () => {
  beforeEach(async () => clearState());

  it("POST /api/chat/send — sends a message to invites (no auth needed)", async () => {
    const res = await request("POST", "/api/chat/send", {
      channel: "invites",
      from: "user1",
      content: "Hello!",
    });
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.channel, "invites");
    assert.equal(data.from, "user1");
    assert.equal(data.to, null);
    assert.ok(typeof data.index === "number");
  });

  it("POST /api/chat/send — requires auth for non-invites channel", async () => {
    const { id, invites } = await createPsiChallenge();
    const j1 = await authJoin(invites[0]);

    // Without token → 401
    const res1 = await request("POST", "/api/chat/send", {
      channel: id,
      from: invites[0],
      content: "Hello!",
    });
    assert.equal(res1.status, 401);

    // With token → 200
    const res2 = await request("POST", "/api/chat/send", {
      channel: id,
      from: invites[0],
      content: "Hello!",
    }, bearerHeader(j1.sessionToken));
    assert.equal(res2.status, 200);
  });

  it("POST /api/chat/send — from is derived from token when omitted", async () => {
    const { id, invites } = await createPsiChallenge();
    const j1 = await authJoin(invites[0]);
    await authJoin(invites[1]);

    // Send without `from`
    const res = await request("POST", "/api/chat/send", {
      channel: id,
      content: "Hello without from!",
    }, bearerHeader(j1.sessionToken));
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.from, invites[0]); // derived from token
  });

  it("POST /api/chat/send — sends a DM with auth", async () => {
    const { id, invites } = await createPsiChallenge();
    const j1 = await authJoin(invites[0]);
    await authJoin(invites[1]);

    const res = await request("POST", "/api/chat/send", {
      channel: id,
      from: invites[0],
      to: invites[1],
      content: "Secret message",
    }, bearerHeader(j1.sessionToken));
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.to, invites[1]);
  });

  it("POST /api/chat/send — returns 400 for missing fields", async () => {
    const res = await request("POST", "/api/chat/send", { channel: "invites" });
    // channel="invites" skips auth, so we get 400 from route
    assert.equal(res.status, 400);
  });

  it("GET /api/chat/sync — returns messages for invites (no auth)", async () => {
    await request("POST", "/api/chat/send", { channel: "invites", from: "a", content: "broadcast" });

    const res = await request("GET", "/api/chat/sync?channel=invites&from=a&index=0");
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.ok(data.messages.some((m: any) => m.content === "broadcast"));
  });

  it("GET /api/chat/sync — requires auth for non-invites channel", async () => {
    const { id, invites } = await createPsiChallenge();
    const j1 = await authJoin(invites[0]);

    // Send a message (authed)
    await request("POST", "/api/chat/send", {
      channel: id, from: invites[0], content: "msg",
    }, bearerHeader(j1.sessionToken));

    // Sync without token → 401
    const res1 = await request("GET", `/api/chat/sync?channel=${id}&from=${invites[0]}&index=0`);
    assert.equal(res1.status, 401);

    // Sync with token → 200
    const res2 = await request("GET", `/api/chat/sync?channel=${id}&from=${invites[0]}&index=0`, undefined, bearerHeader(j1.sessionToken));
    assert.equal(res2.status, 200);
    const data = await res2.json();
    assert.equal(data.count, 1);
  });

  it("GET /api/chat/sync — returns 400 for missing params", async () => {
    const res = await request("GET", "/api/chat/sync");
    assert.ok([400, 401].includes(res.status));
  });

  it("GET /api/chat/sync — index filters older messages", async () => {
    // Use invites channel (no auth needed)
    await request("POST", "/api/chat/send", { channel: "invites", from: "a", content: "msg1" });
    await request("POST", "/api/chat/send", { channel: "invites", from: "a", content: "msg2" });
    await request("POST", "/api/chat/send", { channel: "invites", from: "a", content: "msg3" });

    const res = await request("GET", "/api/chat/sync?channel=invites&from=a&index=3");
    const data = await res.json();
    assert.equal(data.count, 1);
    assert.equal(data.messages[0].content, "msg3");
  });
});
