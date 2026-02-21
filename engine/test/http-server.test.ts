import { describe, it, beforeEach, before, after } from "node:test";
import assert from "node:assert/strict";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";

import app from "../server/index";
import { defaultEngine } from "../engine";
import { generateTestKeypair, signJoin } from "./helpers/auth";

let server: ServerType;
let baseUrl: string;

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

async function authJoin(invite: string) {
  const kp = generateTestKeypair();
  const signature = signJoin(kp.privateKey, invite);
  const res = await req("POST", "/api/arena/join", {
    invite,
    publicKey: kp.publicKeyHex,
    signature,
  });
  return res.json();
}

function bearerHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
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

  it("POST /api/chat/send returns 200 for invites channel", async () => {
    const res = await req("POST", "/api/chat/send", {
      channel: "invites",
      from: "user1",
      content: "Hello!",
    });
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.channel, "invites");
    assert.equal(data.from, "user1");
    assert.ok(typeof data.index === "number");
  });

  it("GET /api/chat/sync returns 200 for invites channel", async () => {
    await req("POST", "/api/chat/send", {
      channel: "invites",
      from: "a",
      content: "hello",
    });

    const res = await req("GET", "/api/chat/sync?channel=invites&from=a&index=0");
    assert.equal(res.status, 200);

    const data = await res.json();
    assert.equal(data.count, 1);
    assert.equal(data.messages[0].content, "hello");
  });

  it("POST /api/arena/join returns 400 for invalid invite, not 500", async () => {
    const res = await req("POST", "/api/arena/join", { invite: "inv_fake" });
    assert.equal(res.status, 400);

    const data = await res.json();
    assert.ok(data.error);
  });

  it("POST /api/arena/message returns 401 without auth", async () => {
    const res = await req("POST", "/api/arena/message", { challengeId: "x", from: "y", content: "z" });
    assert.equal(res.status, 401);
  });

  it("GET /api/arena/sync returns 401 without auth", async () => {
    const res = await req("GET", "/api/arena/sync?channel=x&from=y");
    assert.equal(res.status, 401);
  });

  it("MCP endpoint still responds at /api/chat/mcp", async () => {
    const res = await req("POST", "/api/chat/mcp", {
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

  it("MCP endpoint still responds at /api/arena/mcp", async () => {
    const res = await req("POST", "/api/arena/mcp", {
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

  it("full game flow over HTTP", async () => {
    // Create challenge
    const createRes = await req("POST", "/api/challenges/psi");
    assert.equal(createRes.status, 200);
    const { id, invites } = await createRes.json();

    // Join both players with auth
    const j1 = await authJoin(invites[0]);
    const j2 = await authJoin(invites[1]);
    assert.ok(j1.ChallengeID);
    assert.ok(j2.ChallengeID);

    // Chat between players (authed)
    const chatRes = await req("POST", "/api/chat/send", {
      channel: id,
      from: invites[0],
      content: "Hey opponent!",
    }, bearerHeader(j1.sessionToken));
    assert.equal(chatRes.status, 200);

    // Read chat
    const syncRes = await req("GET", `/api/chat/sync?channel=${id}&from=${invites[0]}&index=0`, undefined, bearerHeader(j1.sessionToken));
    assert.equal(syncRes.status, 200);
    const syncData = await syncRes.json();
    assert.ok(syncData.messages.some((m: any) => m.content === "Hey opponent!"));

    // Get private sets from operator
    const s1 = await (await req("GET", `/api/arena/sync?channel=${id}&from=${invites[0]}&index=0`, undefined, bearerHeader(j1.sessionToken))).json();
    const s2 = await (await req("GET", `/api/arena/sync?channel=${id}&from=${invites[1]}&index=0`, undefined, bearerHeader(j2.sessionToken))).json();
    const setMsg1 = s1.messages.find((m: any) => m.to === invites[0] && m.content.includes("private set"));
    const setMsg2 = s2.messages.find((m: any) => m.to === invites[1] && m.content.includes("private set"));
    assert.ok(setMsg1);
    assert.ok(setMsg2);

    // Parse and find intersection
    const parseSet = (c: string) => {
      const m = c.match(/\{(.+)\}/);
      return m ? new Set(m[1].split(",").map((s) => parseInt(s.trim(), 10))) : new Set<number>();
    };
    const intersection = [...parseSet(setMsg1.content)].filter((n) => parseSet(setMsg2.content).has(n));

    // Submit guesses
    const g1 = await req("POST", "/api/arena/message", {
      challengeId: id, from: invites[0], messageType: "guess", content: intersection.join(", "),
    }, bearerHeader(j1.sessionToken));
    assert.equal(g1.status, 200);

    const g2 = await req("POST", "/api/arena/message", {
      challengeId: id, from: invites[1], messageType: "guess", content: intersection.join(", "),
    }, bearerHeader(j2.sessionToken));
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

  it("POST /api/v1/chat/send works for invites", async () => {
    const res = await req("POST", "/api/v1/chat/send", {
      channel: "invites",
      from: "user1",
      content: "Hello from v1!",
    });
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.channel, "invites");
  });

  it("GET /api/v1/chat/sync works for invites", async () => {
    await req("POST", "/api/v1/chat/send", {
      channel: "invites",
      from: "a",
      content: "msg",
    });
    const res = await req("GET", "/api/v1/chat/sync?channel=invites&from=a&index=0");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.count, 1);
  });

  it("full game flow via /api/v1", async () => {
    const { id, invites } = await (await req("POST", "/api/v1/challenges/psi")).json();

    const j1 = await authJoin(invites[0]);
    const j2 = await authJoin(invites[1]);
    assert.ok(j1.ChallengeID);
    assert.ok(j2.ChallengeID);

    // Chat via v1 (authed)
    const chatRes = await req("POST", "/api/v1/chat/send", {
      channel: id, from: invites[0], content: "v1 chat",
    }, bearerHeader(j1.sessionToken));
    assert.equal(chatRes.status, 200);

    // Sync via v1 (authed)
    const sync = await (await req("GET", `/api/v1/arena/sync?channel=${id}&from=${invites[0]}&index=0`, undefined, bearerHeader(j1.sessionToken))).json();
    assert.ok(sync.messages.length > 0);
  });
});
