import { describe, it, beforeEach, before, after } from "node:test";
import assert from "node:assert/strict";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";

import app from "../server/index";
import { defaultEngine } from "../engine";
import { createDidKeyIdentity, joinWithDidProof } from "./auth-helpers";

let server: ServerType;
let baseUrl: string;

async function req(
  method: string,
  path: string,
  body?: object,
  headers: Record<string, string> = {}
) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function authHeader(accessToken: string): Record<string, string> {
  return { Authorization: `Bearer ${accessToken}` };
}

async function clearState() {
  await defaultEngine.clearRuntimeState();
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

describe("HTTP server — REST routes and auth", () => {
  beforeEach(async () => clearState());

  it("POST /api/auth/nonce returns nonce for join", async () => {
    const createRes = await req("POST", "/api/challenges/psi");
    const { invites } = await createRes.json() as { invites: string[] };

    const nonceRes = await req("POST", "/api/auth/nonce", {
      purpose: "join",
      invite: invites[0],
    });
    assert.equal(nonceRes.status, 200);
    const nonceData = await nonceRes.json();
    assert.ok(nonceData.nonceId);
    assert.ok(nonceData.nonce);
    assert.ok(nonceData.domain);
  });

  it("POST /api/arena/message returns 401 without auth", async () => {
    const res = await req("POST", "/api/arena/message", {
      challengeId: "x",
      messageType: "guess",
      content: "1,2,3",
    });
    assert.equal(res.status, 401);
  });

  it("GET /api/arena/sync returns 401 without auth", async () => {
    const res = await req("GET", "/api/arena/sync?channel=x&index=0");
    assert.equal(res.status, 401);
  });

  it("MCP endpoints still respond", async () => {
    const chatRes = await req("POST", "/api/chat/mcp", {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" },
      },
    });
    assert.ok([200, 406].includes(chatRes.status), `Expected 200 or 406, got ${chatRes.status}`);

    const arenaRes = await req("POST", "/api/arena/mcp", {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test", version: "1.0" },
      },
    });
    assert.ok([200, 406].includes(arenaRes.status), `Expected 200 or 406, got ${arenaRes.status}`);
  });

  it("full game flow over HTTP with bearer auth", async () => {
    const createRes = await req("POST", "/api/challenges/psi");
    const { id, invites } = await createRes.json() as { id: string; invites: string[] };

    const p1 = await joinWithDidProof({
      request: req,
      invite: invites[0],
      identity: createDidKeyIdentity(),
    });
    const p2 = await joinWithDidProof({
      request: req,
      invite: invites[1],
      identity: createDidKeyIdentity(),
    });

    const chatRes = await req(
      "POST",
      "/api/chat/send",
      { channel: id, content: "Hey opponent!" },
      authHeader(p1.auth.accessToken)
    );
    assert.equal(chatRes.status, 200);

    const syncRes = await req(
      "GET",
      `/api/chat/sync?channel=${id}&index=0`,
      undefined,
      authHeader(p1.auth.accessToken)
    );
    assert.equal(syncRes.status, 200);
    const syncData = await syncRes.json();
    assert.ok(syncData.messages.some((m: any) => m.content === "Hey opponent!"));

    const s1 = await (await req("GET", `/api/arena/sync?channel=${id}&index=0`, undefined, authHeader(p1.auth.accessToken))).json();
    const s2 = await (await req("GET", `/api/arena/sync?channel=${id}&index=0`, undefined, authHeader(p2.auth.accessToken))).json();
    const setMsg1 = s1.messages.find((m: any) => m.to === invites[0] && m.content.includes("private set"));
    const setMsg2 = s2.messages.find((m: any) => m.to === invites[1] && m.content.includes("private set"));
    assert.ok(setMsg1);
    assert.ok(setMsg2);

    const parseSet = (c: string): Set<number> => {
      const m = c.match(/\{(.+)\}/);
      return m ? new Set(m[1].split(",").map((s) => parseInt(s.trim(), 10))) : new Set<number>();
    };
    const intersection = [...parseSet(setMsg1.content)].filter((n) => parseSet(setMsg2.content).has(n));

    const g1 = await req(
      "POST",
      "/api/arena/message",
      { challengeId: id, messageType: "guess", content: intersection.join(", ") },
      authHeader(p1.auth.accessToken)
    );
    assert.equal(g1.status, 200);

    const g2 = await req(
      "POST",
      "/api/arena/message",
      { challengeId: id, messageType: "guess", content: intersection.join(", ") },
      authHeader(p2.auth.accessToken)
    );
    assert.equal(g2.status, 200);

    const postEnd = await req(
      "GET",
      `/api/arena/sync?channel=${id}&index=0`,
      undefined,
      authHeader(p1.auth.accessToken)
    );
    assert.equal(postEnd.status, 401);
    const endData = await postEnd.json();
    assert.equal(endData.code, "SESSION_GAME_ENDED");
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

  it("POST /api/v1/challenges/psi creates a challenge", async () => {
    const res = await req("POST", "/api/v1/challenges/psi");
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.ok(data.id);
    assert.equal(data.invites.length, 2);
  });

  it("auth and protected endpoints work via /api/v1", async () => {
    const { id, invites } = await (await req("POST", "/api/v1/challenges/psi")).json() as {
      id: string;
      invites: string[];
    };

    const p1 = await joinWithDidProof({
      request: (method, path, body, headers) => req(method, `/api/v1${path.slice(4)}`, body, headers),
      invite: invites[0],
      identity: createDidKeyIdentity(),
    });

    assert.equal(p1.challengeId, id);

    const sendRes = await req(
      "POST",
      "/api/v1/chat/send",
      { channel: id, content: "v1 chat" },
      authHeader(p1.auth.accessToken)
    );
    assert.equal(sendRes.status, 200);
  });
});
