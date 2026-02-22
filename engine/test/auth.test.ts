import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import app from "../server/index";
import { defaultEngine } from "../engine";
import {
  generateSecret,
  createSessionKey,
  parseSessionKey,
  validateSessionKey,
  verifySignature,
  verifyJoinRequest,
  generateKeyPair,
  sign,
} from "../auth";

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

function signJoinMessage(privateKey: string, challengeId: string, invite: string): { signature: string; timestamp: number } {
  const timestamp = Date.now();
  const message = `${challengeId}:${invite}:${timestamp}`;
  const signature = sign(privateKey, message);
  return { signature, timestamp };
}

async function joinWithAuth(invite: string, challengeId: string, keyPair?: { publicKey: string; privateKey: string }) {
  const kp = keyPair ?? generateKeyPair();
  const { signature, timestamp } = signJoinMessage(kp.privateKey, challengeId, invite);
  const res = await request("POST", "/api/arena/join", {
    invite,
    publicKey: kp.publicKey,
    signature,
    timestamp,
  });
  const data = await res.json();
  return { res, data, keyPair: kp };
}

// --- Unit tests ---

describe("Auth module — unit tests", () => {
  it("generateSecret returns 64 hex chars", () => {
    const secret = generateSecret();
    assert.equal(secret.length, 64);
    assert.match(secret, /^[a-f0-9]{64}$/);
  });

  it("createSessionKey produces correct format", () => {
    const secret = generateSecret();
    const key = createSessionKey(secret, "challenge-123", 0);
    assert.match(key, /^s_\d[a-f0-9]{64}$/);
    assert.equal(key.length, 67);
  });

  it("parseSessionKey extracts components", () => {
    const secret = generateSecret();
    const key = createSessionKey(secret, "challenge-123", 1);
    const parsed = parseSessionKey(key);
    assert.ok(parsed);
    assert.equal(parsed.userIndex, 1);
    assert.equal(parsed.hmac.length, 64);
  });

  it("parseSessionKey returns null for invalid inputs", () => {
    assert.equal(parseSessionKey(""), null);
    assert.equal(parseSessionKey("invalid"), null);
    assert.equal(parseSessionKey("s_x" + "a".repeat(64)), null); // non-numeric index
    assert.equal(parseSessionKey("s_0" + "g".repeat(64)), null); // non-hex hmac
    assert.equal(parseSessionKey("s_0" + "a".repeat(63)), null); // too short
  });

  it("validateSessionKey accepts valid key", () => {
    const secret = generateSecret();
    const challengeId = "test-challenge";
    const key = createSessionKey(secret, challengeId, 0);
    const result = validateSessionKey(secret, key, challengeId);
    assert.equal(result.valid, true);
    if (result.valid) {
      assert.equal(result.userIndex, 0);
    }
  });

  it("validateSessionKey rejects tampered HMAC", () => {
    const secret = generateSecret();
    const key = createSessionKey(secret, "test", 0);
    const tampered = key.slice(0, -1) + (key[key.length - 1] === "a" ? "b" : "a");
    assert.equal(validateSessionKey(secret, tampered, "test").valid, false);
  });

  it("validateSessionKey rejects wrong challengeId", () => {
    const secret = generateSecret();
    const key = createSessionKey(secret, "challenge-1", 0);
    assert.equal(validateSessionKey(secret, key, "challenge-2").valid, false);
  });

  it("validateSessionKey rejects swapped userIndex", () => {
    const secret = generateSecret();
    const key = createSessionKey(secret, "test", 0);
    const swapped = "s_1" + key.slice(3);
    assert.equal(validateSessionKey(secret, swapped, "test").valid, false);
  });

  it("Ed25519 signature round-trip", () => {
    const kp = generateKeyPair();
    const message = "test message";
    const sig = sign(kp.privateKey, message);
    assert.ok(verifySignature(kp.publicKey, sig, message));
  });

  it("Ed25519 rejects wrong key", () => {
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();
    const message = "test message";
    const sig = sign(kp1.privateKey, message);
    assert.equal(verifySignature(kp2.publicKey, sig, message), false);
  });

  it("verifyJoinRequest accepts valid request", () => {
    const kp = generateKeyPair();
    const challengeId = "chal-1";
    const invite = "inv_abc";
    const timestamp = Date.now();
    const msg = `${challengeId}:${invite}:${timestamp}`;
    const sig = sign(kp.privateKey, msg);

    const result = verifyJoinRequest(kp.publicKey, sig, challengeId, invite, timestamp);
    assert.equal(result.valid, true);
  });

  it("verifyJoinRequest rejects expired timestamp", () => {
    const kp = generateKeyPair();
    const challengeId = "chal-1";
    const invite = "inv_abc";
    const timestamp = Date.now() - 6 * 60 * 1000;
    const msg = `${challengeId}:${invite}:${timestamp}`;
    const sig = sign(kp.privateKey, msg);

    const result = verifyJoinRequest(kp.publicKey, sig, challengeId, invite, timestamp);
    assert.equal(result.valid, false);
    if (!result.valid) assert.ok(result.reason.includes("expired"));
  });

  it("verifyJoinRequest rejects invalid signature", () => {
    const kp = generateKeyPair();
    const challengeId = "chal-1";
    const invite = "inv_abc";
    const timestamp = Date.now();

    const result = verifyJoinRequest(kp.publicKey, "bad_sig", challengeId, invite, timestamp);
    assert.equal(result.valid, false);
  });
});

// --- Integration tests ---

describe("Auth — REST API integration", () => {
  beforeEach(async () => clearState());

  it("join with valid Ed25519 signature returns session key", async () => {
    const { id, invites } = await createPsiChallenge();
    const { res, data } = await joinWithAuth(invites[0], id);
    assert.equal(res.status, 200);
    assert.ok(data.sessionKey);
    assert.match(data.sessionKey, /^s_\d[a-f0-9]{64}$/);
    assert.ok(data.ChallengeID);
    assert.ok(data.ChallengeInfo);
  });

  it("public keys stored in challenge.publicKeys", async () => {
    const { id, invites } = await createPsiChallenge();
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();

    await joinWithAuth(invites[0], id, kp1);
    await joinWithAuth(invites[1], id, kp2);

    const challenge = await defaultEngine.getChallenge(id);
    assert.ok(challenge);
    assert.equal(challenge.publicKeys[0], kp1.publicKey);
    assert.equal(challenge.publicKeys[1], kp2.publicKey);
  });

  it("session key works for POST /api/arena/message via Bearer header", async () => {
    const { id, invites } = await createPsiChallenge();
    const { data: join1 } = await joinWithAuth(invites[0], id);
    await joinWithAuth(invites[1], id);

    const res = await request("POST", "/api/arena/message", {
      challengeId: id,
      messageType: "guess",
      content: "100, 200, 300",
    }, bearer(join1.sessionKey));
    assert.equal(res.status, 200);
  });

  it("session key works for GET /api/arena/sync via Bearer header", async () => {
    const { id, invites } = await createPsiChallenge();
    const { data: join1 } = await joinWithAuth(invites[0], id);

    const res = await request("GET", `/api/arena/sync?channel=${id}&index=0`, undefined, bearer(join1.sessionKey));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.messages);
  });

  it("session key works for GET via ?key= query param (SSE fallback)", async () => {
    const { id, invites } = await createPsiChallenge();
    const { data: join1 } = await joinWithAuth(invites[0], id);

    const res = await request("GET", `/api/arena/sync?channel=${id}&index=0&key=${join1.sessionKey}`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.messages);
  });

  it("POST ignores ?key= query param (must use Bearer)", async () => {
    const { id, invites } = await createPsiChallenge();
    const { data: join1 } = await joinWithAuth(invites[0], id);
    await joinWithAuth(invites[1], id);

    const res = await request("POST", `/api/arena/message?key=${join1.sessionKey}`, {
      challengeId: id,
      messageType: "guess",
      content: "100, 200, 300",
    });
    assert.equal(res.status, 401);
  });

  it("session key works for POST /api/chat/send", async () => {
    const { id, invites } = await createPsiChallenge();
    const { data: join1 } = await joinWithAuth(invites[0], id);
    await joinWithAuth(invites[1], id);

    const res = await request("POST", "/api/chat/send", {
      channel: id,
      content: "Hello world",
    }, bearer(join1.sessionKey));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.from, invites[0]);
  });

  it("sync with key: own messages shown, others DMs redacted", async () => {
    const { id, invites } = await createPsiChallenge();
    const { data: join1 } = await joinWithAuth(invites[0], id);
    const { data: join2 } = await joinWithAuth(invites[1], id);

    // Player 1 sends broadcast
    await request("POST", "/api/chat/send", {
      channel: id, content: "broadcast msg",
    }, bearer(join1.sessionKey));
    // Player 2 sends DM to player 1
    await request("POST", "/api/chat/send", {
      channel: id, to: invites[0], content: "DM to p1",
    }, bearer(join2.sessionKey));
    // Player 2 sends DM to self (redacted for p1)
    await request("POST", "/api/chat/send", {
      channel: id, to: invites[1], content: "secret for p2 only",
    }, bearer(join2.sessionKey));

    // Sync as player 1
    const syncRes = await request("GET", `/api/chat/sync?channel=${id}&index=0`, undefined, bearer(join1.sessionKey));
    const syncData = await syncRes.json();

    assert.ok(syncData.messages.some((m: any) => m.content === "broadcast msg"));
    assert.ok(syncData.messages.some((m: any) => m.content === "DM to p1"));
    const redactedMsg = syncData.messages.find((m: any) => m.redacted === true);
    assert.ok(redactedMsg, "should have a redacted message");
    assert.equal(redactedMsg.content, "[redacted]");
  });

  it("full game flow with auth", async () => {
    const { id, invites } = await createPsiChallenge();
    const [inv1, inv2] = invites;

    const { data: j1 } = await joinWithAuth(inv1, id);
    const { data: j2 } = await joinWithAuth(inv2, id);
    assert.ok(j1.sessionKey);
    assert.ok(j2.sessionKey);

    // Sync to get private sets
    const sync1 = await (await request("GET", `/api/arena/sync?channel=${id}&index=0`, undefined, bearer(j1.sessionKey))).json();
    const setMsg1 = sync1.messages.find((m: any) => m.to === inv1 && m.content.includes("Your private set"));
    assert.ok(setMsg1);

    const sync2 = await (await request("GET", `/api/arena/sync?channel=${id}&index=0`, undefined, bearer(j2.sessionKey))).json();
    const setMsg2 = sync2.messages.find((m: any) => m.to === inv2 && m.content.includes("Your private set"));
    assert.ok(setMsg2);

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
    }, bearer(j1.sessionKey))).json();
    assert.ok(g1.ok);

    const g2 = await (await request("POST", "/api/arena/message", {
      challengeId: id, messageType: "guess", content: guessContent,
    }, bearer(j2.sessionKey))).json();
    assert.ok(g2.ok);

    const challenge = await defaultEngine.getChallenge(id);
    assert.ok(challenge);
    assert.equal(challenge.instance.state.gameEnded, true);
    assert.equal(challenge.instance.state.scores[0].utility, 1);
    assert.equal(challenge.instance.state.scores[1].utility, 1);
  });
});

// --- Red team / negative tests ---

describe("Auth — red team / negative tests", () => {
  beforeEach(async () => clearState());

  it("invalid Ed25519 signature → 401 on join", async () => {
    const { id, invites } = await createPsiChallenge();
    const kp = generateKeyPair();

    const res = await request("POST", "/api/arena/join", {
      invite: invites[0],
      publicKey: kp.publicKey,
      signature: "deadbeef".repeat(8),
      timestamp: Date.now(),
    });
    assert.equal(res.status, 401);
  });

  it("wrong public key → 401 on join", async () => {
    const { id, invites } = await createPsiChallenge();
    const kp1 = generateKeyPair();
    const kp2 = generateKeyPair();

    const { signature, timestamp } = signJoinMessage(kp1.privateKey, id, invites[0]);
    const res = await request("POST", "/api/arena/join", {
      invite: invites[0],
      publicKey: kp2.publicKey,
      signature,
      timestamp,
    });
    assert.equal(res.status, 401);
  });

  it("expired timestamp (replay attack) → 401 on join", async () => {
    const { id, invites } = await createPsiChallenge();
    const kp = generateKeyPair();
    const timestamp = Date.now() - 10 * 60 * 1000;
    const message = `${id}:${invites[0]}:${timestamp}`;
    const signature = sign(kp.privateKey, message);

    const res = await request("POST", "/api/arena/join", {
      invite: invites[0],
      publicKey: kp.publicKey,
      signature,
      timestamp,
    });
    assert.equal(res.status, 401);
  });

  it("invalid session key format → 401", async () => {
    const { id, invites } = await createPsiChallenge();
    await joinWithAuth(invites[0], id);
    await joinWithAuth(invites[1], id);

    const res = await request("POST", "/api/arena/message", {
      challengeId: id,
      messageType: "guess",
      content: "100, 200, 300",
    }, bearer("invalid_key"));
    assert.equal(res.status, 401);
  });

  it("tampered HMAC in session key → 401", async () => {
    const { id, invites } = await createPsiChallenge();
    const { data } = await joinWithAuth(invites[0], id);
    await joinWithAuth(invites[1], id);

    const tampered = data.sessionKey.slice(0, -1) + (data.sessionKey.endsWith("a") ? "b" : "a");
    const res = await request("POST", "/api/arena/message", {
      challengeId: id,
      messageType: "guess",
      content: "100, 200, 300",
    }, bearer(tampered));
    assert.equal(res.status, 401);
  });

  it("swapped user index → 401", async () => {
    const { id, invites } = await createPsiChallenge();
    const { data } = await joinWithAuth(invites[0], id);
    await joinWithAuth(invites[1], id);

    const swapped = "s_1" + data.sessionKey.slice(3);
    const res = await request("POST", "/api/arena/message", {
      challengeId: id,
      messageType: "guess",
      content: "100, 200, 300",
    }, bearer(swapped));
    assert.equal(res.status, 401);
  });

  it("session key from different challenge → 401", async () => {
    const c1 = await createPsiChallenge();
    const c2 = await createPsiChallenge();

    const { data: j1 } = await joinWithAuth(c1.invites[0], c1.id);
    await joinWithAuth(c1.invites[1], c1.id);
    await joinWithAuth(c2.invites[0], c2.id);
    await joinWithAuth(c2.invites[1], c2.id);

    const res = await request("POST", "/api/arena/message", {
      challengeId: c2.id,
      messageType: "guess",
      content: "100, 200, 300",
    }, bearer(j1.sessionKey));
    assert.equal(res.status, 401);
  });

  it("missing session key on POST /api/arena/message → 401", async () => {
    const { id, invites } = await createPsiChallenge();
    await joinWithAuth(invites[0], id);
    await joinWithAuth(invites[1], id);

    const res = await request("POST", "/api/arena/message", {
      challengeId: id,
      messageType: "guess",
      content: "100, 200, 300",
    });
    assert.equal(res.status, 401);
  });

  it("post to chat without session key → 401", async () => {
    const res = await request("POST", "/api/chat/send", {
      channel: "test-channel",
      from: "user1",
      content: "Hello!",
    });
    assert.equal(res.status, 401);
  });

  it("forge session key with guessed HMAC → 401", async () => {
    const { id, invites } = await createPsiChallenge();
    await joinWithAuth(invites[0], id);
    await joinWithAuth(invites[1], id);

    const forged = "s_0" + "a".repeat(64);
    const res = await request("POST", "/api/arena/message", {
      challengeId: id,
      messageType: "guess",
      content: "100, 200, 300",
    }, bearer(forged));
    assert.equal(res.status, 401);
  });

  it("use valid key after game end for write → 403", async () => {
    const { id, invites } = await createPsiChallenge();
    const { data: j1 } = await joinWithAuth(invites[0], id);
    const { data: j2 } = await joinWithAuth(invites[1], id);

    // End the game
    await request("POST", "/api/arena/message", {
      challengeId: id, messageType: "guess", content: "1, 2, 3",
    }, bearer(j1.sessionKey));
    await request("POST", "/api/arena/message", {
      challengeId: id, messageType: "guess", content: "1, 2, 3",
    }, bearer(j2.sessionKey));

    const challenge = await defaultEngine.getChallenge(id);
    assert.ok(challenge?.instance.state.gameEnded);

    const res = await request("POST", "/api/arena/message", {
      challengeId: id, messageType: "guess", content: "4, 5, 6",
    }, bearer(j1.sessionKey));
    assert.equal(res.status, 403);
  });

  it("valid key after game end still works for reads (GET sync)", async () => {
    const { id, invites } = await createPsiChallenge();
    const { data: j1 } = await joinWithAuth(invites[0], id);
    const { data: j2 } = await joinWithAuth(invites[1], id);

    await request("POST", "/api/arena/message", {
      challengeId: id, messageType: "guess", content: "1, 2, 3",
    }, bearer(j1.sessionKey));
    await request("POST", "/api/arena/message", {
      challengeId: id, messageType: "guess", content: "1, 2, 3",
    }, bearer(j2.sessionKey));

    const res = await request("GET", `/api/arena/sync?channel=${id}&index=0`, undefined, bearer(j1.sessionKey));
    assert.equal(res.status, 200);
  });

  it("server ignores from field — uses authenticated identity", async () => {
    const { id, invites } = await createPsiChallenge();
    const { data: j1 } = await joinWithAuth(invites[0], id);
    await joinWithAuth(invites[1], id);

    const res = await request("POST", "/api/chat/send", {
      channel: id,
      from: invites[1], // attacker tries to impersonate
      content: "Impersonation attempt",
    }, bearer(j1.sessionKey));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.from, invites[0]);
  });
});
