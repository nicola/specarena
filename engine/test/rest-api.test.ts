import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import app from "../server/index";
import { defaultEngine } from "../engine";
import { generateKeyPair, sign } from "../auth";

// --- Helpers ---

async function request(method: string, path: string, body?: object, headers?: Record<string, string>) {
  return app.request(path, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function bearer(key: string) {
  return { Authorization: `Bearer ${key}` };
}

async function clearState() {
  await defaultEngine.clearRuntimeState();
}

async function createPsiChallenge() {
  const res = await request("POST", "/api/challenges/psi");
  assert.equal(res.status, 200);
  return res.json();
}

function signJoin(privateKey: string, challengeId: string, invite: string) {
  const timestamp = Date.now();
  const message = `${challengeId}:${invite}:${timestamp}`;
  return { signature: sign(privateKey, message), timestamp };
}

async function joinWithAuth(invite: string, challengeId: string) {
  const kp = generateKeyPair();
  const { signature, timestamp } = signJoin(kp.privateKey, challengeId, invite);
  const res = await request("POST", "/api/arena/join", {
    invite, publicKey: kp.publicKey, signature, timestamp,
  });
  const data = await res.json();
  return { sessionKey: data.sessionKey as string, data, keyPair: kp };
}

// --- Tests ---

describe("REST API for arena", () => {
  beforeEach(async () => clearState());

  it("POST /api/arena/join — joins a challenge with auth", async () => {
    const { id, invites } = await createPsiChallenge();
    const { data } = await joinWithAuth(invites[0], id);
    assert.ok(data.ChallengeID);
    assert.ok(data.ChallengeInfo);
    assert.ok(data.sessionKey);
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
    const { sessionKey: key1 } = await joinWithAuth(invites[0], id);
    await joinWithAuth(invites[1], id);

    const res = await request("POST", "/api/arena/message", {
      challengeId: id,
      messageType: "guess",
      content: "100, 200, 300",
    }, bearer(key1));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.ok || data.error);
  });

  it("POST /api/arena/message — returns 401 for missing key", async () => {
    const res = await request("POST", "/api/arena/message", { challengeId: "x" });
    assert.equal(res.status, 401);
  });

  it("GET /api/arena/sync — returns messages with auth", async () => {
    const { id, invites } = await createPsiChallenge();
    const { sessionKey } = await joinWithAuth(invites[0], id);

    const res = await request("GET", `/api/arena/sync?channel=${id}&index=0`, undefined, bearer(sessionKey));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.messages);
    assert.ok(data.count >= 1);
  });

  it("GET /api/arena/sync — returns 400 for missing channel", async () => {
    const res = await request("GET", "/api/arena/sync");
    assert.equal(res.status, 400);
  });

  it("full game via REST API", async () => {
    const { id, invites } = await createPsiChallenge();
    const [inv1, inv2] = invites;

    const { sessionKey: key1 } = await joinWithAuth(inv1, id);
    const { sessionKey: key2 } = await joinWithAuth(inv2, id);

    // Sync to get private sets
    const sync1 = await (await request("GET", `/api/arena/sync?channel=${id}&index=0`, undefined, bearer(key1))).json();
    const setMsg1 = sync1.messages.find((m: any) => m.to === inv1 && m.content.includes("Your private set"));
    assert.ok(setMsg1);

    const sync2 = await (await request("GET", `/api/arena/sync?channel=${id}&index=0`, undefined, bearer(key2))).json();
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

    const guessContent = [...intersection].join(", ");
    const g1 = await (await request("POST", "/api/arena/message", {
      challengeId: id, messageType: "guess", content: guessContent,
    }, bearer(key1))).json();
    assert.ok(g1.ok);

    const g2 = await (await request("POST", "/api/arena/message", {
      challengeId: id, messageType: "guess", content: guessContent,
    }, bearer(key2))).json();
    assert.ok(g2.ok);

    const instance = await defaultEngine.getChallenge(id);
    assert.ok(instance);
    assert.equal(instance.instance.state.gameEnded, true);
    assert.equal(instance.instance.state.scores[0].utility, 1);
    assert.equal(instance.instance.state.scores[1].utility, 1);
  });
});

describe("REST API for chat", () => {
  beforeEach(async () => clearState());

  it("POST /api/chat/send — sends a message with auth", async () => {
    const { id, invites } = await createPsiChallenge();
    const { sessionKey } = await joinWithAuth(invites[0], id);
    await joinWithAuth(invites[1], id);

    const res = await request("POST", "/api/chat/send", {
      channel: id,
      content: "Hello!",
    }, bearer(sessionKey));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.channel, id);
    assert.equal(data.from, invites[0]);
    assert.ok(typeof data.index === "number");
  });

  it("POST /api/chat/send — sends a DM with auth", async () => {
    const { id, invites } = await createPsiChallenge();
    const { sessionKey } = await joinWithAuth(invites[0], id);
    await joinWithAuth(invites[1], id);

    const res = await request("POST", "/api/chat/send", {
      channel: id,
      to: invites[1],
      content: "Secret message",
    }, bearer(sessionKey));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.to, invites[1]);
  });

  it("POST /api/chat/send — returns 401 for missing key", async () => {
    const res = await request("POST", "/api/chat/send", { channel: "x", content: "hi" });
    assert.equal(res.status, 401);
  });

  it("GET /api/chat/sync — returns messages with auth + redaction", async () => {
    const { id, invites } = await createPsiChallenge();
    const { sessionKey: key1 } = await joinWithAuth(invites[0], id);
    const { sessionKey: key2 } = await joinWithAuth(invites[1], id);

    // Send messages
    await request("POST", "/api/chat/send", { channel: id, content: "broadcast" }, bearer(key1));
    await request("POST", "/api/chat/send", { channel: id, to: invites[0], content: "DM to A" }, bearer(key2));
    await request("POST", "/api/chat/send", { channel: id, to: invites[1], content: "DM to B only" }, bearer(key2));

    // Sync as user A with auth
    const res = await request("GET", `/api/chat/sync?channel=${id}&index=0`, undefined, bearer(key1));
    assert.equal(res.status, 200);
    const data = await res.json();

    // A sees broadcast, DM to A, and redacted DM to B
    assert.ok(data.messages.some((m: any) => m.content === "broadcast"));
    assert.ok(data.messages.some((m: any) => m.content === "DM to A"));
    const redacted = data.messages.find((m: any) => m.redacted === true);
    assert.ok(redacted);
    assert.equal(redacted.content, "[redacted]");
  });

  it("GET /api/chat/sync — unauthenticated with from param works", async () => {
    // Use engine directly to send a message (bypassing auth)
    await defaultEngine.chat.chatSend("test-ch", "user1", "hello");

    const res = await request("GET", "/api/chat/sync?channel=test-ch&from=user1&index=0");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.count, 1);
  });

  it("GET /api/chat/sync — index filters older messages", async () => {
    const { id, invites } = await createPsiChallenge();
    const { sessionKey } = await joinWithAuth(invites[0], id);
    await joinWithAuth(invites[1], id);

    await request("POST", "/api/chat/send", { channel: id, content: "msg1" }, bearer(sessionKey));
    await request("POST", "/api/chat/send", { channel: id, content: "msg2" }, bearer(sessionKey));
    await request("POST", "/api/chat/send", { channel: id, content: "msg3" }, bearer(sessionKey));

    const res = await request("GET", `/api/chat/sync?channel=${id}&index=3`, undefined, bearer(sessionKey));
    const data = await res.json();
    assert.equal(data.count, 1);
    assert.equal(data.messages[0].content, "msg3");
  });
});
