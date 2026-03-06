import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { generateKeyPair, generateSecret, hashPublicKey, sign } from "../auth/utils";
import { createAuthApp } from "../auth/index";
import { readNextSSEData } from "./helpers/sse";

const secret = generateSecret();
const { app, engine } = createAuthApp({ secret });

const keyA = generateKeyPair();
const keyB = generateKeyPair();
const hashA = hashPublicKey(keyA.publicKey);
const hashB = hashPublicKey(keyB.publicKey);

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

function signSend(privateKey: string, timestamp: number) {
  return sign(privateKey, `arena:v1:send:${timestamp}`);
}

function signChannelRead(privateKey: string, timestamp: number) {
  return sign(privateKey, `arena:v1:channel-read:${timestamp}`);
}

async function createChallenge() {
  const res = await request("POST", "/api/challenges/psi");
  assert.equal(res.status, 200);
  return res.json();
}

function signJoin(privateKey: string, invite: string, timestamp: number) {
  return sign(privateKey, `arena:v1:join:${invite}:${timestamp}`);
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

describe("User channels — Ed25519 signed write", () => {
  beforeEach(async () => engine.clearRuntimeState());

  it("POST to user channel with valid signature succeeds", async () => {
    const timestamp = Date.now();
    const signature = signSend(keyA.privateKey, timestamp);
    const res = await request("POST", "/api/chat/send", {
      channel: `user_${hashA}`,
      content: "hello user channel",
    }, {
      "Content-Type": "application/json",
    });
    // Without signature, viewer identity → 400
    assert.equal(res.status, 400);

    // With signature via query params
    const res2 = await app.request(
      `/api/chat/send?publicKey=${keyA.publicKey}&signature=${signature}&timestamp=${timestamp}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: `user_${hashA}`, content: "hello user channel" }),
      }
    );
    assert.equal(res2.status, 200);
    const data = await res2.json();
    assert.equal(data.from, hashA);
  });

  it("POST to user channel without signature returns 400 (viewer identity)", async () => {
    const res = await request("POST", "/api/chat/send", {
      channel: `user_${hashA}`,
      content: "no auth",
    });
    assert.equal(res.status, 400);
  });

  it("POST to user channel with expired timestamp returns 401", async () => {
    const staleTimestamp = Date.now() - 10 * 60 * 1000;
    const signature = signSend(keyA.privateKey, staleTimestamp);
    const res = await app.request(
      `/api/chat/send?publicKey=${keyA.publicKey}&signature=${signature}&timestamp=${staleTimestamp}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: `user_${hashA}`, content: "expired" }),
      }
    );
    assert.equal(res.status, 401);
  });

  it("POST to user channel with wrong key returns 401", async () => {
    const timestamp = Date.now();
    // Sign with A's key but send B's publicKey
    const signature = signSend(keyA.privateKey, timestamp);
    const res = await app.request(
      `/api/chat/send?publicKey=${keyB.publicKey}&signature=${signature}&timestamp=${timestamp}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: `user_${hashA}`, content: "wrong key" }),
      }
    );
    assert.equal(res.status, 401);
  });
});

describe("User channels — Ed25519 signed read", () => {
  beforeEach(async () => engine.clearRuntimeState());

  it("GET user channel as owner shows full messages", async () => {
    // First send a message to the user channel
    const sendTs = Date.now();
    const sendSig = signSend(keyA.privateKey, sendTs);
    await app.request(
      `/api/chat/send?publicKey=${keyA.publicKey}&signature=${sendSig}&timestamp=${sendTs}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: `user_${hashA}`, content: "secret msg" }),
      }
    );

    // Read as owner
    const readTs = Date.now();
    const readSig = signChannelRead(keyA.privateKey, readTs);
    const res = await app.request(
      `/api/chat/sync?channel=user_${hashA}&index=0&publicKey=${keyA.publicKey}&signature=${readSig}&timestamp=${readTs}`
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.messages.length > 0);
    assert.ok(data.messages.some((m: any) => m.content === "secret msg"));
    assert.ok(!data.messages.some((m: any) => m.redacted));
  });

  it("GET user channel as different user shows redacted messages", async () => {
    // Send a message to A's channel
    const sendTs = Date.now();
    const sendSig = signSend(keyA.privateKey, sendTs);
    await app.request(
      `/api/chat/send?publicKey=${keyA.publicKey}&signature=${sendSig}&timestamp=${sendTs}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: `user_${hashA}`, content: "private" }),
      }
    );

    // Read as B
    const readTs = Date.now();
    const readSig = signChannelRead(keyB.privateKey, readTs);
    const res = await app.request(
      `/api/chat/sync?channel=user_${hashA}&index=0&publicKey=${keyB.publicKey}&signature=${readSig}&timestamp=${readTs}`
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.messages.length > 0);
    for (const msg of data.messages) {
      assert.equal(msg.redacted, true);
      assert.equal(msg.content, "");
    }
  });

  it("GET user channel without signature shows redacted messages", async () => {
    // Send a message
    const sendTs = Date.now();
    const sendSig = signSend(keyA.privateKey, sendTs);
    await app.request(
      `/api/chat/send?publicKey=${keyA.publicKey}&signature=${sendSig}&timestamp=${sendTs}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: `user_${hashA}`, content: "viewer test" }),
      }
    );

    // Read with no auth
    const res = await request("GET", `/api/chat/sync?channel=user_${hashA}&index=0`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.messages.length > 0);
    for (const msg of data.messages) {
      assert.equal(msg.redacted, true);
    }
  });
});

describe("User channels — cross-user messaging", () => {
  beforeEach(async () => engine.clearRuntimeState());

  it("user A sends invite to user B's channel, B can read it", async () => {
    // A sends to B's channel
    const sendTs = Date.now();
    const sendSig = signSend(keyA.privateKey, sendTs);
    const sendRes = await app.request(
      `/api/chat/send?publicKey=${keyA.publicKey}&signature=${sendSig}&timestamp=${sendTs}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: `user_${hashB}`, content: "hey B, join my game!" }),
      }
    );
    assert.equal(sendRes.status, 200);

    // B reads their own channel
    const readTs = Date.now();
    const readSig = signChannelRead(keyB.privateKey, readTs);
    const res = await app.request(
      `/api/chat/sync?channel=user_${hashB}&index=0&publicKey=${keyB.publicKey}&signature=${readSig}&timestamp=${readTs}`
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.messages.some((m: any) => m.content === "hey B, join my game!"));
  });

  it("user A cannot read user B's channel", async () => {
    // Send to B's channel
    const sendTs = Date.now();
    const sendSig = signSend(keyA.privateKey, sendTs);
    await app.request(
      `/api/chat/send?publicKey=${keyA.publicKey}&signature=${sendSig}&timestamp=${sendTs}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: `user_${hashB}`, content: "secret for B" }),
      }
    );

    // A tries to read B's channel
    const readTs = Date.now();
    const readSig = signChannelRead(keyA.privateKey, readTs);
    const res = await app.request(
      `/api/chat/sync?channel=user_${hashB}&index=0&publicKey=${keyA.publicKey}&signature=${readSig}&timestamp=${readTs}`
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    for (const msg of data.messages) {
      assert.equal(msg.redacted, true);
    }
  });
});

describe("Invites channel — open reads, signed writes", () => {
  beforeEach(async () => engine.clearRuntimeState());

  it("GET invites channel without auth returns messages", async () => {
    // Seed a message (standalone mode has no auth middleware blocking)
    await engine.chat.sendMessage("invites", "system", "test invite");

    const res = await request("GET", "/api/chat/sync?channel=invites&index=0");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.messages.length > 0);
  });

  it("POST to invites channel with valid signature succeeds", async () => {
    const timestamp = Date.now();
    const signature = signSend(keyA.privateKey, timestamp);
    const res = await app.request(
      `/api/chat/send?publicKey=${keyA.publicKey}&signature=${signature}&timestamp=${timestamp}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: "invites", content: "join my game: inv_abc" }),
      }
    );
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.from, hashA);
  });

  it("POST to invites channel without signature returns 400", async () => {
    const res = await request("POST", "/api/chat/send", {
      channel: "invites",
      content: "no auth invite",
    });
    assert.equal(res.status, 400);
  });
});

describe("Chat channel prefix — chat_<challengeId>", () => {
  beforeEach(async () => engine.clearRuntimeState());

  it("player chat uses chat_ prefix", async () => {
    const { id, invites } = await createChallenge();
    const { data: join0 } = await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    // Send to chat_<id>
    const res = await app.request(
      `/api/chat/send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${join0.sessionKey}`,
        },
        body: JSON.stringify({ channel: `chat_${id}`, content: "hello via chat prefix" }),
      }
    );
    assert.equal(res.status, 200);

    // Sync chat_<id>
    const syncRes = await app.request(
      `/api/chat/sync?channel=chat_${id}&index=0&key=${join0.sessionKey}`
    );
    assert.equal(syncRes.status, 200);
    const data = await syncRes.json();
    assert.ok(data.messages.some((m: any) => m.content === "hello via chat prefix"));
  });

  it("bare challengeId no longer works for player chat", async () => {
    const { id, invites } = await createChallenge();
    const { data: join0 } = await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    // Send to chat_<id>
    await app.request(
      `/api/chat/send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${join0.sessionKey}`,
        },
        body: JSON.stringify({ channel: `chat_${id}`, content: "prefixed msg" }),
      }
    );

    // Sync bare <id> — should NOT see the message
    const syncRes = await app.request(
      `/api/chat/sync?channel=${id}&index=0&key=${join0.sessionKey}`
    );
    assert.equal(syncRes.status, 200);
    const data = await syncRes.json();
    assert.ok(!data.messages.some((m: any) => m.content === "prefixed msg"));
  });
});
