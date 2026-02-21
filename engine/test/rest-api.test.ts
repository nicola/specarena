import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import app from "../server/index";
import { defaultEngine } from "../engine";
import { createDidKeyIdentity, joinWithDidProof } from "./auth-helpers";

async function request(
  method: string,
  path: string,
  body?: object,
  headers: Record<string, string> = {}
) {
  return app.request(path, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function clearState() {
  await defaultEngine.clearRuntimeState();
}

async function createPsiChallenge() {
  const res = await request("POST", "/api/challenges/psi");
  assert.equal(res.status, 200);
  return res.json() as Promise<{ id: string; invites: string[] }>;
}

function authHeader(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

describe("REST API for arena auth", () => {
  beforeEach(async () => clearState());

  it("POST /api/arena/join — signed join returns session token", async () => {
    const { invites } = await createPsiChallenge();
    const identity = createDidKeyIdentity();

    const joined = await joinWithDidProof({
      request,
      invite: invites[0],
      identity,
    });

    assert.ok(joined.challengeId);
    assert.ok(joined.auth.accessToken);
    assert.equal(joined.auth.invite, invites[0]);
    assert.equal(joined.auth.did, identity.did);
  });

  it("POST /api/arena/join — unsigned join is allowed when did proof is optional", async () => {
    const { invites } = await createPsiChallenge();

    const res = await request("POST", "/api/arena/join", { invite: invites[0] });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.auth?.accessToken);
    assert.ok(String(data.auth?.did).startsWith("did:arena:anon:"));
  });

  it("POST /api/arena/join — returns 400 for missing invite", async () => {
    const res = await request("POST", "/api/arena/join", {});
    assert.equal(res.status, 400);
  });

  it("POST /api/arena/message requires auth token", async () => {
    const res = await request("POST", "/api/arena/message", {
      challengeId: "x",
      messageType: "guess",
      content: "1 2 3",
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, "AUTH_REQUIRED");
  });

  it("GET /api/arena/sync requires auth token", async () => {
    const res = await request("GET", "/api/arena/sync?channel=abc&index=0");
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, "AUTH_REQUIRED");
  });

  it("full game via REST API with bearer auth", async () => {
    const { id, invites } = await createPsiChallenge();
    const [inv1, inv2] = invites;

    const p1 = await joinWithDidProof({ request, invite: inv1 });
    const p2 = await joinWithDidProof({ request, invite: inv2 });
    assert.equal(p1.challengeId, id);
    assert.equal(p2.challengeId, id);

    const sync1 = await (await request(
      "GET",
      `/api/arena/sync?channel=${id}&index=0`,
      undefined,
      authHeader(p1.auth.accessToken)
    )).json();
    const setMsg1 = sync1.messages.find((m: any) => m.to === inv1 && m.content.includes("Your private set"));
    assert.ok(setMsg1);

    const sync2 = await (await request(
      "GET",
      `/api/arena/sync?channel=${id}&index=0`,
      undefined,
      authHeader(p2.auth.accessToken)
    )).json();
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
    const g1 = await (await request(
      "POST",
      "/api/arena/message",
      { challengeId: id, messageType: "guess", content: guessContent },
      authHeader(p1.auth.accessToken)
    )).json();
    assert.ok(g1.ok);

    const g2 = await (await request(
      "POST",
      "/api/arena/message",
      { challengeId: id, messageType: "guess", content: guessContent },
      authHeader(p2.auth.accessToken)
    )).json();
    assert.ok(g2.ok);

    const challenge = await defaultEngine.getChallenge(id);
    assert.ok(challenge);
    assert.equal(challenge.instance.state.gameEnded, true);
  });

  it("tokens are invalid after game ends", async () => {
    const { id, invites } = await createPsiChallenge();
    const p1 = await joinWithDidProof({ request, invite: invites[0] });
    const p2 = await joinWithDidProof({ request, invite: invites[1] });

    const guess = "100, 200, 300";
    await request("POST", "/api/arena/message", { challengeId: id, messageType: "guess", content: guess }, authHeader(p1.auth.accessToken));
    await request("POST", "/api/arena/message", { challengeId: id, messageType: "guess", content: guess }, authHeader(p2.auth.accessToken));

    const postEnd = await request(
      "GET",
      `/api/arena/sync?channel=${id}&index=0`,
      undefined,
      authHeader(p1.auth.accessToken)
    );
    assert.equal(postEnd.status, 401);
    const data = await postEnd.json();
    assert.equal(data.code, "SESSION_GAME_ENDED");
  });
});

describe("REST API for chat auth", () => {
  beforeEach(async () => clearState());

  it("POST /api/chat/send requires auth for non-invites channels", async () => {
    const res = await request("POST", "/api/chat/send", {
      channel: "test-channel",
      content: "Hello!",
    });
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, "AUTH_REQUIRED");
  });

  it("GET /api/chat/sync requires auth for non-invites channels", async () => {
    const res = await request("GET", "/api/chat/sync?channel=test-channel&index=0");
    assert.equal(res.status, 401);
    const data = await res.json();
    assert.equal(data.code, "AUTH_REQUIRED");
  });

  it("invites channel still supports unauthenticated sync/send", async () => {
    const send = await request("POST", "/api/chat/send", {
      channel: "invites",
      from: "listener",
      content: "inv_123",
    });
    assert.equal(send.status, 200);

    const sync = await request("GET", "/api/chat/sync?channel=invites&from=listener&index=0");
    assert.equal(sync.status, 200);
    const data = await sync.json();
    assert.ok(data.messages.some((m: any) => m.content === "inv_123"));
  });

  it("chat send/sync works with session token for challenge channel", async () => {
    const { id, invites } = await createPsiChallenge();
    const identityA = createDidKeyIdentity();
    const identityB = createDidKeyIdentity();
    const p1 = await joinWithDidProof({ request, invite: invites[0], identity: identityA });
    await joinWithDidProof({ request, invite: invites[1], identity: identityB });

    const send = await request(
      "POST",
      "/api/chat/send",
      { channel: id, content: "Hello opponent!" },
      authHeader(p1.auth.accessToken)
    );
    assert.equal(send.status, 200);
    const sendData = await send.json();
    assert.equal(sendData.from, invites[0]);

    const sync = await request(
      "GET",
      `/api/chat/sync?channel=${id}&index=0`,
      undefined,
      authHeader(p1.auth.accessToken)
    );
    assert.equal(sync.status, 200);
    const syncData = await sync.json();
    assert.ok(syncData.messages.some((m: any) => m.content === "Hello opponent!"));
  });
});
