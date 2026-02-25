import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { generateKeyPair, generateSecret, hashPublicKey, sign } from "../utils";
import { createAuthApp } from "../server/index";

// --- Auth-enabled engine + app ---

const secret = generateSecret();
const { app, engine } = createAuthApp({ secret });

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

  it("rejects message with no session key (400 — viewer has no identity)", async () => {
    const { id, invites } = await createChallenge();
    await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    const res = await request("POST", "/api/arena/message", {
      challengeId: id,
      messageType: "guess",
      content: "100",
    });
    assert.equal(res.status, 400);
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

  it("sync without session key returns 200 with redacted data (viewer mode)", async () => {
    const { id, invites } = await createChallenge();
    await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    const res = await request("GET", `/api/arena/sync?channel=${id}&index=0`);
    assert.equal(res.status, 200);
    const data = await res.json();
    // Viewer should see messages but all private messages should be redacted
    const privateMessages = data.messages.filter((m: any) => m.to);
    for (const msg of privateMessages) {
      assert.ok(msg.redacted, "all private messages should be redacted for viewer");
    }
  });

  it("sync with forged session key returns 401", async () => {
    const { id, invites } = await createChallenge();
    await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    const forgedKey = "s_0." + "ab".repeat(32);
    const res = await request("GET", `/api/arena/sync?channel=${id}&index=0&key=${forgedKey}`);
    assert.equal(res.status, 401);
  });

  it("sync with wrong challenge's session key returns 401", async () => {
    const c1 = await createChallenge();
    const c2 = await createChallenge();

    const { data: join1 } = await joinWithAuth(c1.invites[0], keyA);
    await joinWithAuth(c2.invites[0], keyA);
    await joinWithAuth(c2.invites[1], keyB);

    // Use c1's session key to sync c2
    const res = await request("GET", `/api/arena/sync?channel=${c2.id}&index=0&key=${join1.sessionKey}`);
    assert.equal(res.status, 401);
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

  it("chat send without session key returns 400 (viewer has no identity)", async () => {
    const { id, invites } = await createChallenge();
    await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    const res = await request("POST", "/api/chat/send", {
      channel: `challenge_${id}`,
      content: "hello",
    });
    assert.equal(res.status, 400);
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

describe("Viewer-mode redaction — chat/ws SSE endpoint (leaderboard path)", () => {
  beforeEach(async () => engine.clearRuntimeState());

  /** Reads the next SSE `data:` payload from an open stream reader. */
  async function readNextSSEData(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    buf: { s: string },
    timeoutMs = 2000
  ): Promise<any> {
    const decoder = new TextDecoder();
    const deadline = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("SSE read timed out")), timeoutMs)
    );
    async function drain(): Promise<any> {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) throw new Error("Stream ended before data event");
        buf.s += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.s.indexOf("\n\n")) !== -1) {
          const block = buf.s.slice(0, nl);
          buf.s = buf.s.slice(nl + 2);
          const line = block.split("\n").find((l) => l.startsWith("data: "));
          if (line) return JSON.parse(line.slice(6));
        }
      }
    }
    return Promise.race([drain(), deadline]);
  }

  it("initial SSE batch — DMs are redacted for viewer", async () => {
    const { id, invites } = await createChallenge();
    const { data: join0 } = await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    // Player 0 sends a DM to player 1 on the challenge channel
    await authedRequest("POST", "/api/chat/send", join0.sessionKey, {
      channel: `challenge_${id}`,
      to: invites[1],
      content: "secret handshake",
    });

    // Connect as viewer (no auth token) — should see the DM as redacted
    const res = await request("GET", `/api/chat/ws/challenge_${id}`);
    assert.equal(res.status, 200);
    assert.ok(
      res.headers.get("content-type")?.includes("text/event-stream"),
      "should return an SSE stream"
    );

    const reader = res.body!.getReader();
    const buf = { s: "" };
    try {
      const event = await readNextSSEData(reader, buf);
      assert.equal(event.type, "initial");
      const dms = (event.messages as any[]).filter((m: any) => m.to);
      assert.ok(dms.length > 0, "channel should contain the DM that was just sent");
      for (const dm of dms) {
        assert.equal(dm.redacted, true, `DM from=${dm.from} to=${dm.to} must be redacted for viewer`);
        assert.equal(dm.content, "", "redacted DM must have empty content string");
      }
    } finally {
      reader.cancel().catch(() => {});
    }
  });

  it("initial SSE batch — broadcasts are not redacted for viewer", async () => {
    const { id, invites } = await createChallenge();
    const { data: join0 } = await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    // Player 0 sends a broadcast on the challenge channel
    await authedRequest("POST", "/api/chat/send", join0.sessionKey, {
      channel: `challenge_${id}`,
      content: "hello everyone",
    });

    const res = await request("GET", `/api/chat/ws/challenge_${id}`);
    assert.equal(res.status, 200);

    const reader = res.body!.getReader();
    const buf = { s: "" };
    try {
      const event = await readNextSSEData(reader, buf);
      assert.equal(event.type, "initial");
      const broadcasts = (event.messages as any[]).filter((m: any) => !m.to);
      assert.ok(broadcasts.length > 0, "should have at least one broadcast");
      for (const bc of broadcasts) {
        assert.ok(bc.redacted !== true, `broadcast from ${bc.from} must not be redacted`);
        assert.ok(bc.content !== undefined, "broadcast must have a content field");
      }
    } finally {
      reader.cancel().catch(() => {});
    }
  });

  it("live SSE new_message — DM is redacted for viewer", async () => {
    const { id, invites } = await createChallenge();
    const { data: join0 } = await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    // Subscribe to SSE as viewer before sending the DM
    const res = await request("GET", `/api/chat/ws/challenge_${id}`);
    assert.equal(res.status, 200);

    const reader = res.body!.getReader();
    const buf = { s: "" };
    try {
      // Read initial event — this also ensures the channel subscription is active
      // (subscribeToChannel is called before chatSync, so the subscriber is ready)
      const initialEvent = await readNextSSEData(reader, buf);
      assert.equal(initialEvent.type, "initial");

      // Player 0 sends a DM to player 1 — viewer should receive a redacted new_message
      await authedRequest("POST", "/api/chat/send", join0.sessionKey, {
        channel: `challenge_${id}`,
        to: invites[1],
        content: "secret handshake",
      });

      // Next event should be a live new_message with the DM redacted for viewer
      const liveEvent = await readNextSSEData(reader, buf);
      assert.equal(liveEvent.type, "new_message");
      assert.ok(liveEvent.message.to, "event should be a DM (non-null to field)");
      assert.equal(liveEvent.message.redacted, true, "live DM must be redacted for viewer");
      assert.equal(liveEvent.message.content, "", "redacted live DM must have empty content");
    } finally {
      reader.cancel().catch(() => {});
    }
  });
});

describe("Concurrent SSE streams", () => {
  beforeEach(async () => engine.clearRuntimeState());

  /** Reads the next SSE `data:` payload from an open stream reader. */
  async function readNextSSEData(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    buf: { s: string },
    timeoutMs = 2000
  ): Promise<any> {
    const decoder = new TextDecoder();
    const deadline = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("SSE read timed out")), timeoutMs)
    );
    async function drain(): Promise<any> {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) throw new Error("Stream ended before data event");
        buf.s += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.s.indexOf("\n\n")) !== -1) {
          const block = buf.s.slice(0, nl);
          buf.s = buf.s.slice(nl + 2);
          const line = block.split("\n").find((l) => l.startsWith("data: "));
          if (line) return JSON.parse(line.slice(6));
        }
      }
    }
    return Promise.race([drain(), deadline]);
  }

  it("multiple viewers receive all messages", async () => {
    const { id, invites } = await createChallenge();
    const { data: join0 } = await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    // Two viewers subscribe to the same channel
    const res1 = await request("GET", `/api/chat/ws/challenge_${id}`);
    const res2 = await request("GET", `/api/chat/ws/challenge_${id}`);
    const reader1 = res1.body!.getReader();
    const reader2 = res2.body!.getReader();
    const buf1 = { s: "" };
    const buf2 = { s: "" };

    try {
      // Both get initial event
      const init1 = await readNextSSEData(reader1, buf1);
      const init2 = await readNextSSEData(reader2, buf2);
      assert.equal(init1.type, "initial");
      assert.equal(init2.type, "initial");

      // Send 3 broadcast messages
      for (let i = 0; i < 3; i++) {
        await authedRequest("POST", "/api/chat/send", join0.sessionKey, {
          channel: `challenge_${id}`,
          content: `msg-${i}`,
        });
      }

      // Both viewers should receive all 3
      for (let i = 0; i < 3; i++) {
        const ev1 = await readNextSSEData(reader1, buf1);
        const ev2 = await readNextSSEData(reader2, buf2);
        assert.equal(ev1.type, "new_message");
        assert.equal(ev2.type, "new_message");
        assert.equal(ev1.message.content, `msg-${i}`);
        assert.equal(ev2.message.content, `msg-${i}`);
      }
    } finally {
      reader1.cancel().catch(() => {});
      reader2.cancel().catch(() => {});
    }
  });

  it("one viewer disconnecting doesn't break others", async () => {
    const { id, invites } = await createChallenge();
    const { data: join0 } = await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    const res1 = await request("GET", `/api/chat/ws/challenge_${id}`);
    const res2 = await request("GET", `/api/chat/ws/challenge_${id}`);
    const reader1 = res1.body!.getReader();
    const reader2 = res2.body!.getReader();
    const buf1 = { s: "" };
    const buf2 = { s: "" };

    try {
      await readNextSSEData(reader1, buf1); // initial
      await readNextSSEData(reader2, buf2); // initial

      // Disconnect viewer 1
      await reader1.cancel();

      // Send a message — viewer 2 should still receive it
      await authedRequest("POST", "/api/chat/send", join0.sessionKey, {
        channel: `challenge_${id}`,
        content: "after-disconnect",
      });

      const ev2 = await readNextSSEData(reader2, buf2);
      assert.equal(ev2.type, "new_message");
      assert.equal(ev2.message.content, "after-disconnect");
    } finally {
      reader1.cancel().catch(() => {});
      reader2.cancel().catch(() => {});
    }
  });

  it("game_ended event is received by viewer with structured scores", async () => {
    const { id, invites } = await createChallenge();
    const { data: join0 } = await joinWithAuth(invites[0], keyA);
    const { data: join1 } = await joinWithAuth(invites[1], keyB);

    const res = await request("GET", `/api/chat/ws/challenge_${id}`);
    const reader = res.body!.getReader();
    const buf = { s: "" };

    try {
      const init = await readNextSSEData(reader, buf);
      assert.equal(init.type, "initial");

      // End the game
      await authedRequest("POST", "/api/arena/message", join0.sessionKey,
        { challengeId: id, messageType: "guess", content: "100" });
      await authedRequest("POST", "/api/arena/message", join1.sessionKey,
        { challengeId: id, messageType: "guess", content: "100" });

      // Drain events until game_ended
      let gameEnded: any = null;
      for (let i = 0; i < 10; i++) {
        const ev = await readNextSSEData(reader, buf);
        if (ev.type === "game_ended") { gameEnded = ev; break; }
      }
      assert.ok(gameEnded, "game_ended event must be received");
      assert.ok(Array.isArray(gameEnded.state.scores), "scores should be an array");
      assert.equal(gameEnded.state.scores.length, 2);
      assert.ok(typeof gameEnded.state.scores[0].security === "number");
      assert.ok(typeof gameEnded.state.scores[0].utility === "number");
      assert.ok(Array.isArray(gameEnded.state.players));
    } finally {
      reader.cancel().catch(() => {});
    }
  });

  it("late viewer gets game_ended after initial for finished game", async () => {
    const { id, invites } = await createChallenge();
    const { data: join0 } = await joinWithAuth(invites[0], keyA);
    const { data: join1 } = await joinWithAuth(invites[1], keyB);

    // End the game first
    await authedRequest("POST", "/api/arena/message", join0.sessionKey,
      { challengeId: id, messageType: "guess", content: "100" });
    await authedRequest("POST", "/api/arena/message", join1.sessionKey,
      { challengeId: id, messageType: "guess", content: "100" });

    // Late viewer connects
    const res = await request("GET", `/api/chat/ws/challenge_${id}`);
    const reader = res.body!.getReader();
    const buf = { s: "" };

    try {
      const init = await readNextSSEData(reader, buf);
      assert.equal(init.type, "initial");
      assert.ok(init.messages.length > 0);

      const ended = await readNextSSEData(reader, buf);
      assert.equal(ended.type, "game_ended");
      assert.ok(Array.isArray(ended.state.scores));
      assert.equal(ended.state.scores.length, 2);
    } finally {
      reader.cancel().catch(() => {});
    }
  });

  it("messages continue flowing during active game", async () => {
    const { id, invites } = await createChallenge();
    const { data: join0 } = await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    const res = await request("GET", `/api/chat/ws/challenge_${id}`);
    const reader = res.body!.getReader();
    const buf = { s: "" };

    try {
      const init = await readNextSSEData(reader, buf);
      assert.equal(init.type, "initial");

      // Send 3 messages sequentially
      for (let i = 0; i < 3; i++) {
        await authedRequest("POST", "/api/chat/send", join0.sessionKey, {
          channel: `challenge_${id}`,
          content: `flow-${i}`,
        });
      }

      // All 3 arrive as new_message events in order
      for (let i = 0; i < 3; i++) {
        const ev = await readNextSSEData(reader, buf);
        assert.equal(ev.type, "new_message");
        assert.equal(ev.message.content, `flow-${i}`, `message ${i} should arrive in order`);
      }
    } finally {
      reader.cancel().catch(() => {});
    }
  });
});

describe("Player identities — hashPublicKey", () => {
  it("returns a 64-char hex SHA-256 hash", () => {
    const hash = hashPublicKey(keyA.publicKey);
    assert.equal(hash.length, 64);
    assert.match(hash, /^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same key", () => {
    assert.equal(hashPublicKey(keyA.publicKey), hashPublicKey(keyA.publicKey));
  });

  it("produces different hashes for different keys", () => {
    assert.notEqual(hashPublicKey(keyA.publicKey), hashPublicKey(keyB.publicKey));
  });
});

describe("Player identities — stored after authenticated join", () => {
  beforeEach(async () => engine.clearRuntimeState());

  it("playerIdentities maps invite to hashed public key after join", async () => {
    const { id, invites } = await createChallenge();
    await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    const challenge = await engine.getChallenge(id);
    assert.ok(challenge);
    const identities = challenge.instance.state.playerIdentities;

    assert.equal(identities[invites[0]], hashPublicKey(keyA.publicKey));
    assert.equal(identities[invites[1]], hashPublicKey(keyB.publicKey));
  });

  it("playerIdentities appears in game_ended SSE event", async () => {
    const { id, invites } = await createChallenge();
    const { data: join0 } = await joinWithAuth(invites[0], keyA);
    const { data: join1 } = await joinWithAuth(invites[1], keyB);

    // End the game by submitting guesses
    await authedRequest("POST", "/api/arena/message", join0.sessionKey,
      { challengeId: id, messageType: "guess", content: "100" });
    await authedRequest("POST", "/api/arena/message", join1.sessionKey,
      { challengeId: id, messageType: "guess", content: "100" });

    // Late viewer connects and receives game_ended
    const res = await request("GET", `/api/chat/ws/${id}`);
    const reader = res.body!.getReader();
    const buf = { s: "" };

    /** Reads the next SSE `data:` payload from an open stream reader. */
    async function readNextSSEData(
      r: ReadableStreamDefaultReader<Uint8Array>,
      b: { s: string },
      timeoutMs = 2000
    ): Promise<any> {
      const decoder = new TextDecoder();
      const deadline = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("SSE read timed out")), timeoutMs)
      );
      async function drain(): Promise<any> {
        for (;;) {
          const { done, value } = await r.read();
          if (done) throw new Error("Stream ended before data event");
          b.s += decoder.decode(value, { stream: true });
          let nl: number;
          while ((nl = b.s.indexOf("\n\n")) !== -1) {
            const block = b.s.slice(0, nl);
            b.s = b.s.slice(nl + 2);
            const line = block.split("\n").find((l) => l.startsWith("data: "));
            if (line) return JSON.parse(line.slice(6));
          }
        }
      }
      return Promise.race([drain(), deadline]);
    }

    try {
      // Drain until game_ended
      let gameEnded: any = null;
      for (let i = 0; i < 10; i++) {
        const ev = await readNextSSEData(reader, buf);
        if (ev.type === "game_ended") { gameEnded = ev; break; }
      }
      assert.ok(gameEnded, "game_ended event must be received");
      assert.ok(gameEnded.state.playerIdentities, "game_ended must include playerIdentities");
      assert.equal(gameEnded.state.playerIdentities[invites[0]], hashPublicKey(keyA.publicKey));
      assert.equal(gameEnded.state.playerIdentities[invites[1]], hashPublicKey(keyB.publicKey));
    } finally {
      reader.cancel().catch(() => {});
    }
  });

  it("getPlayerIdentities returns null before game ends", async () => {
    const { id, invites } = await createChallenge();
    await joinWithAuth(invites[0], keyA);
    await joinWithAuth(invites[1], keyB);

    const identities = await engine.getPlayerIdentities(id);
    assert.equal(identities, null);
  });

  it("getPlayerIdentities returns mapping after game ends", async () => {
    const { id, invites } = await createChallenge();
    const { data: join0 } = await joinWithAuth(invites[0], keyA);
    const { data: join1 } = await joinWithAuth(invites[1], keyB);

    // End the game
    await authedRequest("POST", "/api/arena/message", join0.sessionKey,
      { challengeId: id, messageType: "guess", content: "100" });
    await authedRequest("POST", "/api/arena/message", join1.sessionKey,
      { challengeId: id, messageType: "guess", content: "100" });

    const identities = await engine.getPlayerIdentities(id);
    assert.ok(identities);
    assert.equal(identities[invites[0]], hashPublicKey(keyA.publicKey));
    assert.equal(identities[invites[1]], hashPublicKey(keyB.publicKey));
  });
});
