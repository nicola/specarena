import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { createEngine } from "../engine";
import { AuthEngine } from "../auth/AuthEngine";
import { generateKeyPair, generateSecret, sign } from "../auth/utils";
import { createApp, registerChallengesFromConfig } from "../server/index";

// --- Auth-enabled engine + app ---

const secret = generateSecret();
const authEngine = new AuthEngine(secret);
const engine = createEngine({ authEngine });
registerChallengesFromConfig(engine);
const app = createApp(engine);

// Two independent key pairs (simulating two different clients)
const keyA = generateKeyPair();
const keyB = generateKeyPair();

// --- Helpers ---

async function request(method: string, path: string, body?: object, headers?: Record<string, string>) {
  return app.request(path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function authedRequest(method: string, path: string, sessionKey: string, body?: object) {
  return request(method, path, body, { Authorization: `Bearer ${sessionKey}` });
}

async function createChallenge() {
  const res = await request("POST", "/api/challenges/psi");
  assert.equal(res.status, 200);
  return res.json();
}

function signJoin(privateKey: string, invite: string, timestamp: number) {
  const message = `arena:v1:join:${invite}:${timestamp}`;
  return sign(privateKey, message);
}

async function joinWithAuth(invite: string, kp: { publicKey: string; privateKey: string }) {
  const timestamp = Date.now();
  const signature = signJoin(kp.privateKey, invite, timestamp);
  const res = await request("POST", "/api/arena/join", {
    invite,
    publicKey: kp.publicKey,
    signature,
    timestamp,
  });
  return { res, data: await res.json() };
}

// --- Tests ---

describe("Auth security — join signature verification", () => {
  beforeEach(async () => engine.clearRuntimeState());

  it("rejects join with no signature fields", async () => {
    const { invites } = await createChallenge();
    const res = await request("POST", "/api/arena/join", { invite: invites[0] });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error.includes("required"));
  });

  it("rejects join with wrong key pair (signature doesn't match publicKey)", async () => {
    const { invites } = await createChallenge();
    const timestamp = Date.now();
    // Sign with key A's private key but send key B's public key
    const signature = signJoin(keyA.privateKey, invites[0], timestamp);
    const res = await request("POST", "/api/arena/join", {
      invite: invites[0],
      publicKey: keyB.publicKey,
      signature,
      timestamp,
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error.includes("Invalid signature"));
  });

  it("rejects join with tampered invite in signature", async () => {
    const { invites } = await createChallenge();
    const timestamp = Date.now();
    // Sign for a different invite than what we send
    const signature = signJoin(keyA.privateKey, "inv_fake", timestamp);
    const res = await request("POST", "/api/arena/join", {
      invite: invites[0],
      publicKey: keyA.publicKey,
      signature,
      timestamp,
    });
    assert.equal(res.status, 401);
  });

  it("rejects join with expired timestamp", async () => {
    const { invites } = await createChallenge();
    const staleTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
    const signature = signJoin(keyA.privateKey, invites[0], staleTimestamp);
    const res = await request("POST", "/api/arena/join", {
      invite: invites[0],
      publicKey: keyA.publicKey,
      signature,
      timestamp: staleTimestamp,
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.ok(data.error.includes("Timestamp"));
  });

  it("rejects join with garbage signature", async () => {
    const { invites } = await createChallenge();
    const res = await request("POST", "/api/arena/join", {
      invite: invites[0],
      publicKey: keyA.publicKey,
      signature: "deadbeef".repeat(8),
      timestamp: Date.now(),
    });
    assert.equal(res.status, 401);
  });

  it("accepts join with valid signature and returns sessionKey", async () => {
    const { invites } = await createChallenge();
    const { res, data } = await joinWithAuth(invites[0], keyA);
    assert.equal(res.status, 200);
    assert.ok(data.sessionKey, "should return a session key");
    assert.ok(data.sessionKey.startsWith("s_"), "session key format");
    assert.ok(data.ChallengeID);
  });
});

describe("Auth security — session key validation on message route", () => {
  beforeEach(async () => engine.clearRuntimeState());

  it("rejects message with no session key (401)", async () => {
    const { id, invites } = await createChallenge();
    await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    const res = await request("POST", "/api/arena/message", {
      challengeId: id,
      messageType: "guess",
      content: "100",
    });
    assert.equal(res.status, 401);
  });

  it("rejects message with garbage session key", async () => {
    const { id, invites } = await createChallenge();
    await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    const res = await authedRequest("POST", "/api/arena/message", "totally_invalid_key", {
      challengeId: id,
      messageType: "guess",
      content: "100",
    });
    assert.equal(res.status, 401);
  });

  it("rejects message with well-formed but forged session key", async () => {
    const { id, invites } = await createChallenge();
    await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    // Construct a plausible-looking key with the right format but wrong HMAC
    const forgedKey = "s_0." + "ab".repeat(32);
    const res = await authedRequest("POST", "/api/arena/message", forgedKey, {
      challengeId: id,
      messageType: "guess",
      content: "100",
    });
    assert.equal(res.status, 401);
  });

  it("rejects message with session key from a different challenge", async () => {
    // Create two challenges
    const c1 = await createChallenge();
    const c2 = await createChallenge();

    // Join challenge 1 and get a session key
    const { data: join1 } = await joinWithAuth(c1.invites[0], keyA);
    const sessionKeyForC1 = join1.sessionKey;

    // Join challenge 2 so it has players
    await joinWithAuth(c2.invites[0], keyA);
    await joinWithAuth(c2.invites[1], keyB);

    // Try to use challenge 1's session key to send a message in challenge 2
    const res = await authedRequest("POST", "/api/arena/message", sessionKeyForC1, {
      challengeId: c2.id,
      messageType: "guess",
      content: "100",
    });
    // The HMAC is bound to challengeId, so it should fail validation
    assert.equal(res.status, 401);
  });

  it("rejects message with session key for wrong user index", async () => {
    const { id, invites } = await createChallenge();
    const { data: join0 } = await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    // Player 0's session key has userIndex=0. Manually craft one with userIndex=1
    // but using the HMAC from player 0's key — should fail
    const stolenKey = join0.sessionKey.replace("s_0.", "s_1.");
    const res = await authedRequest("POST", "/api/arena/message", stolenKey, {
      challengeId: id,
      messageType: "guess",
      content: "100",
    });
    assert.equal(res.status, 401);
  });

  it("accepts message with valid session key", async () => {
    const { id, invites } = await createChallenge();
    const { data: join0 } = await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    const res = await authedRequest("POST", "/api/arena/message", join0.sessionKey, {
      challengeId: id,
      messageType: "guess",
      content: "100, 200, 300",
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.ok || data.error); // game logic may accept or reject the guess
  });
});

describe("Auth security — session key validation on sync route", () => {
  beforeEach(async () => engine.clearRuntimeState());

  it("sync without session key returns redacted messages (no identity)", async () => {
    const { id, invites } = await createChallenge();
    await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    // Sync with no auth — should get messages but private ones are redacted
    const res = await request("GET", `/api/arena/sync?channel=${id}&index=0`);
    assert.equal(res.status, 200);
    const data = await res.json();

    // All private messages (with a `to` field) should be redacted
    const privateMessages = data.messages.filter((m: any) => m.to);
    assert.ok(privateMessages.length > 0, "should have private messages");
    for (const msg of privateMessages) {
      assert.ok(msg.redacted, `private message to ${msg.to} should be redacted`);
      assert.equal(msg.content, "", "redacted content should be empty");
    }
  });

  it("sync with forged session key still returns redacted messages", async () => {
    const { id, invites } = await createChallenge();
    await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    const forgedKey = "s_0." + "ab".repeat(32);
    const res = await request("GET", `/api/arena/sync?channel=${id}&index=0&key=${forgedKey}`);
    assert.equal(res.status, 200);
    const data = await res.json();

    const privateMessages = data.messages.filter((m: any) => m.to);
    for (const msg of privateMessages) {
      assert.ok(msg.redacted, "forged key should not decrypt private messages");
    }
  });

  it("sync with wrong challenge's session key returns redacted messages", async () => {
    const c1 = await createChallenge();
    const c2 = await createChallenge();

    const { data: join1 } = await joinWithAuth(c1.invites[0], keyA);
    await joinWithAuth(c2.invites[0], keyA);
    await joinWithAuth(c2.invites[1], keyB);

    // Use c1's session key to sync c2
    const res = await request("GET", `/api/arena/sync?channel=${c2.id}&index=0&key=${join1.sessionKey}`);
    assert.equal(res.status, 200);
    const data = await res.json();

    const privateMessages = data.messages.filter((m: any) => m.to);
    for (const msg of privateMessages) {
      assert.ok(msg.redacted, "cross-challenge key should not reveal private messages");
    }
  });

  it("sync with valid session key reveals own private messages", async () => {
    const { id, invites } = await createChallenge();
    const { data: join0 } = await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    const res = await request("GET", `/api/arena/sync?channel=${id}&index=0&key=${join0.sessionKey}`);
    assert.equal(res.status, 200);
    const data = await res.json();

    // Player 0's own private set message should be visible (not redacted)
    const ownPrivate = data.messages.find(
      (m: any) => m.to === invites[0] && m.from === "operator" && m.content.includes("Your private set")
    );
    assert.ok(ownPrivate, "should see own private set in cleartext");
    assert.ok(!ownPrivate.redacted, "own messages should not be redacted");

    // Player 1's private set message should be redacted
    const otherPrivate = data.messages.find(
      (m: any) => m.to === invites[1] && m.from === "operator"
    );
    assert.ok(otherPrivate?.redacted, "opponent's private messages should be redacted");
  });
});

describe("Auth security — chat routes with session keys", () => {
  beforeEach(async () => engine.clearRuntimeState());

  it("chat send without session key returns 401", async () => {
    const { id, invites } = await createChallenge();
    await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    const res = await request("POST", "/api/chat/send", {
      channel: `challenge_${id}`,
      content: "hello",
    });
    assert.equal(res.status, 401);
  });

  it("chat send with valid session key succeeds and uses resolved identity", async () => {
    const { id, invites } = await createChallenge();
    const { data: join0 } = await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    const res = await authedRequest("POST", "/api/chat/send", join0.sessionKey, {
      channel: `challenge_${id}`,
      content: "hello from player 0",
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    // The `from` should be the resolved player identity (the invite code), not something the client chose
    assert.equal(data.from, invites[0], "identity should be resolved from session key, not client-supplied");
  });

  it("chat send ignores client-supplied 'from' when session key is present", async () => {
    const { id, invites } = await createChallenge();
    const { data: join0 } = await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    // Try to impersonate player 1 by passing from=invites[1]
    const res = await authedRequest("POST", "/api/chat/send", join0.sessionKey, {
      channel: `challenge_${id}`,
      from: invites[1], // attempted impersonation
      content: "I am definitely player 1",
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    // Should use the identity from the session key (player 0), not the body
    assert.equal(data.from, invites[0], "should use session identity, ignoring client 'from'");
  });
});
