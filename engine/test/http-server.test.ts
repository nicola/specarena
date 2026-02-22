import { describe, it, beforeEach, before, after } from "node:test";
import assert from "node:assert/strict";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";

import app from "../server/index";
import { defaultEngine } from "../engine";
import { generateKeyPair, sign } from "../auth";

// Test against a real HTTP server to catch routing issues that app.request() misses.

let server: ServerType;
let baseUrl: string;

function bearerHeaders(key: string): Record<string, string> {
  return { Authorization: `Bearer ${key}` };
}

async function req(method: string, path: string, body?: object, headers?: Record<string, string>) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...(body ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function clearState() {
  await defaultEngine.clearRuntimeState();
}

function signJoin(privateKey: string, challengeId: string, invite: string) {
  const timestamp = Date.now();
  const message = `${challengeId}:${invite}:${timestamp}`;
  return { signature: sign(privateKey, message), timestamp };
}

async function joinWithAuth(invite: string, challengeId: string) {
  const kp = generateKeyPair();
  const { signature, timestamp } = signJoin(kp.privateKey, challengeId, invite);
  const res = await req("POST", "/api/arena/join", {
    invite, publicKey: kp.publicKey, signature, timestamp,
  });
  const data = await res.json();
  return { sessionKey: data.sessionKey as string, data };
}

before(async () => {
  await new Promise<void>((resolve) => {
    server = serve({ fetch: app.fetch, port: 0 }, (info) => {
      baseUrl = `http://localhost:${info.port}`;
      resolve();
    });
  });
});

after(() => {
  server.close();
});

describe("HTTP server — REST routes don't collide with MCP wildcards", () => {
  beforeEach(async () => clearState());

  it("POST /api/chat/send returns 401 without key", async () => {
    const res = await req("POST", "/api/chat/send", {
      channel: "test-channel",
      from: "user1",
      content: "Hello!",
    });
    assert.equal(res.status, 401);
  });

  it("POST /api/chat/send returns 200 with valid Bearer key", async () => {
    const createRes = await req("POST", "/api/challenges/psi");
    const { id, invites } = await createRes.json();
    const { sessionKey } = await joinWithAuth(invites[0], id);
    await joinWithAuth(invites[1], id);

    const res = await req("POST", "/api/chat/send", {
      channel: id,
      content: "Hello!",
    }, bearerHeaders(sessionKey));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.channel, id);
    assert.equal(data.from, invites[0]);
  });

  it("GET /api/chat/sync returns 401 without auth", async () => {
    await defaultEngine.chat.chatSend("ch1", "a", "hello");

    const res = await req("GET", "/api/chat/sync?channel=ch1&from=a&index=0");
    assert.equal(res.status, 401);
  });

  it("POST /api/arena/join returns 400 for missing auth params", async () => {
    const res = await req("POST", "/api/arena/join", { invite: "inv_fake" });
    assert.equal(res.status, 400);
    const data = await res.json();
    assert.ok(data.error);
  });

  it("POST /api/arena/message returns 401 for missing key", async () => {
    const res = await req("POST", "/api/arena/message", { challengeId: "x" });
    assert.equal(res.status, 401);
  });

  it("GET /api/arena/sync returns 400 for missing params, not 500", async () => {
    const res = await req("GET", "/api/arena/sync");
    assert.equal(res.status, 400);
  });

  it("MCP endpoint responds at /api/mcp/chat/mcp", async () => {
    const res = await req("POST", "/api/mcp/chat/mcp", {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" },
      },
    });
    assert.ok([200, 406].includes(res.status), `Expected 200 or 406, got ${res.status}`);
  });

  it("MCP endpoint responds at /api/mcp/arena/mcp", async () => {
    const res = await req("POST", "/api/mcp/arena/mcp", {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" },
      },
    });
    assert.ok([200, 406].includes(res.status), `Expected 200 or 406, got ${res.status}`);
  });

  it("full game flow over HTTP with auth", async () => {
    const createRes = await req("POST", "/api/challenges/psi");
    assert.equal(createRes.status, 200);
    const { id, invites } = await createRes.json();

    const { sessionKey: key1 } = await joinWithAuth(invites[0], id);
    const { sessionKey: key2 } = await joinWithAuth(invites[1], id);

    // Chat between players
    const chatRes = await req("POST", "/api/chat/send", {
      channel: id,
      content: "Hey opponent!",
    }, bearerHeaders(key1));
    assert.equal(chatRes.status, 200);

    // Read chat with auth
    const syncRes = await req("GET", `/api/chat/sync?channel=${id}&index=0`, undefined, bearerHeaders(key1));
    assert.equal(syncRes.status, 200);
    const syncData = await syncRes.json();
    assert.ok(syncData.messages.some((m: any) => m.content === "Hey opponent!"));

    // Get private sets
    const s1 = await (await req("GET", `/api/arena/sync?channel=${id}&index=0`, undefined, bearerHeaders(key1))).json();
    const s2 = await (await req("GET", `/api/arena/sync?channel=${id}&index=0`, undefined, bearerHeaders(key2))).json();
    const setMsg1 = s1.messages.find((m: any) => m.to === invites[0] && m.content.includes("private set"));
    const setMsg2 = s2.messages.find((m: any) => m.to === invites[1] && m.content.includes("private set"));
    assert.ok(setMsg1);
    assert.ok(setMsg2);

    const parseSet = (c: string) => {
      const m = c.match(/\{(.+)\}/);
      return m ? new Set(m[1].split(",").map((s) => parseInt(s.trim(), 10))) : new Set<number>();
    };
    const intersection = [...parseSet(setMsg1.content)].filter((n) => parseSet(setMsg2.content).has(n));

    const g1 = await req("POST", "/api/arena/message", {
      challengeId: id, messageType: "guess", content: intersection.join(", "),
    }, bearerHeaders(key1));
    assert.equal(g1.status, 200);

    const g2 = await req("POST", "/api/arena/message", {
      challengeId: id, messageType: "guess", content: intersection.join(", "),
    }, bearerHeaders(key2));
    assert.equal(g2.status, 200);
  });
});

describe("HTTP server — /api/v1 routes mirror /api", () => {
  beforeEach(async () => clearState());

  it("GET /api/v1/metadata returns challenge metadata", async () => {
    const res = await req("GET", "/api/v1/metadata");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.psi);
  });

  it("GET /api/v1/metadata/psi returns single challenge", async () => {
    const res = await req("GET", "/api/v1/metadata/psi");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.name, "Private Set Intersection");
  });

  it("POST /api/v1/challenges/psi creates a challenge", async () => {
    const res = await req("POST", "/api/v1/challenges/psi");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.id);
    assert.equal(data.invites.length, 2);
  });

  it("POST /api/v1/chat/send with auth", async () => {
    const { id, invites } = await (await req("POST", "/api/v1/challenges/psi")).json();
    const { sessionKey } = await joinWithAuth(invites[0], id);
    await joinWithAuth(invites[1], id);

    const res = await req("POST", "/api/v1/chat/send", {
      channel: id,
      content: "Hello from v1!",
    }, bearerHeaders(sessionKey));
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.channel, id);
  });

  it("GET /api/v1/chat/sync returns 401 without auth", async () => {
    await defaultEngine.chat.chatSend("v1-ch", "a", "msg");
    const res = await req("GET", "/api/v1/chat/sync?channel=v1-ch&from=a&index=0");
    assert.equal(res.status, 401);
  });

  it("full game flow via /api/v1 with auth", async () => {
    const { id, invites } = await (await req("POST", "/api/v1/challenges/psi")).json();

    const { sessionKey: key1 } = await joinWithAuth(invites[0], id);
    const { sessionKey: key2 } = await joinWithAuth(invites[1], id);

    const chatRes = await req("POST", "/api/v1/chat/send", {
      channel: id, content: "v1 chat",
    }, bearerHeaders(key1));
    assert.equal(chatRes.status, 200);

    const sync = await (await req("GET", `/api/v1/arena/sync?channel=${id}&index=0`, undefined, bearerHeaders(key1))).json();
    assert.ok(sync.messages.length > 0);
  });
});
