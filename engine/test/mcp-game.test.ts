import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { serve } from "@hono/node-server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import app from "../server/index";
import { defaultEngine } from "../engine";
import { createDidKeyIdentity } from "./auth-helpers";

let baseUrl: string;
let server: ReturnType<typeof serve>;

async function clearState() {
  await defaultEngine.clearRuntimeState();
}

async function createArenaClient(): Promise<Client> {
  const client = new Client({ name: "test-arena", version: "1.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`${baseUrl}/api/arena/mcp`)
  );
  await client.connect(transport);
  return client;
}

async function createChatClient(): Promise<Client> {
  const client = new Client({ name: "test-chat", version: "1.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`${baseUrl}/api/chat/mcp`)
  );
  await client.connect(transport);
  return client;
}

async function callTool(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as any)?.[0]?.text;
  if (!text) return result;
  try {
    return JSON.parse(text);
  } catch {
    return { _text: text };
  }
}

async function mcpJoin(client: Client, invite: string) {
  const identity = createDidKeyIdentity();
  const nonceRes = await callTool(client, "auth_nonce", { purpose: "join", invite });
  const timestamp = Date.now();
  const signature = identity.signJoinProof({
    domain: nonceRes.domain,
    invite,
    nonce: nonceRes.nonce,
    nonceId: nonceRes.nonceId,
    timestamp,
  });
  const joinRes = await callTool(client, "challenge_join", {
    invite,
    did: identity.did,
    nonceId: nonceRes.nonceId,
    signature,
    timestamp,
  });
  return joinRes as {
    ChallengeID: string;
    auth: { accessToken: string };
  };
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
  server?.close();
  (server as any)?.closeAllConnections?.();
});

describe("PSI game via MCP protocol", () => {
  beforeEach(async () => {
    await clearState();
  });

  it("MCP client connects and lists tools", async () => {
    const client = await createArenaClient();
    const tools = await client.listTools();
    const toolNames = tools.tools.map((t) => t.name);
    assert.ok(toolNames.includes("auth_nonce"));
    assert.ok(toolNames.includes("challenge_join"));
    assert.ok(toolNames.includes("challenge_message"));
    assert.ok(toolNames.includes("challenge_sync"));
    await client.close();
  });

  it("full game via MCP: join → chat → guess → scores", async () => {
    const arena = await createArenaClient();
    const chat = await createChatClient();

    const createRes = await fetch(`${baseUrl}/api/challenges/psi`, { method: "POST" });
    const { id: challengeId, invites } = await createRes.json() as { id: string; invites: string[] };
    const [invite1, invite2] = invites;

    const join1 = await mcpJoin(arena, invite1);
    const join2 = await mcpJoin(arena, invite2);
    assert.equal(join1.ChallengeID, challengeId);
    assert.equal(join2.ChallengeID, challengeId);

    const token1 = join1.auth.accessToken;
    const token2 = join2.auth.accessToken;
    const instance = await defaultEngine.getChallenge(challengeId);
    assert.ok(instance);
    assert.equal(instance.instance.state.gameStarted, true);

    const sync1 = await callTool(arena, "challenge_sync", {
      authToken: token1,
      channel: challengeId,
      index: 0,
    });
    const p1SetMsg = sync1.messages.find(
      (m: any) => m.to === invite1 && m.content.includes("Your private set")
    );
    assert.ok(p1SetMsg);

    const sync2 = await callTool(arena, "challenge_sync", {
      authToken: token2,
      channel: challengeId,
      index: 0,
    });
    const leakedP1 = sync2.messages.find(
      (m: any) => m.to === invite1 && m.from === "operator"
    );
    assert.equal(leakedP1, undefined);

    const chat1 = await callTool(chat, "send_chat", {
      authToken: token1,
      channel: challengeId,
      content: "Hello! Let's find the intersection.",
    });
    assert.ok(chat1.index);

    const chat2 = await callTool(chat, "send_chat", {
      authToken: token2,
      channel: challengeId,
      content: "Sure thing!",
    });
    assert.ok(chat2.index);

    const chatSync = await callTool(chat, "sync", {
      authToken: token1,
      channel: challengeId,
      index: 0,
    });
    assert.ok(chatSync.messages.length >= 2);

    const parseSet = (content: string): Set<number> => {
      const match = content.match(/\{(.+)\}/);
      if (!match) return new Set();
      return new Set(match[1].split(",").map((s) => parseInt(s.trim(), 10)));
    };
    const p2SetMsg = sync2.messages.find(
      (m: any) => m.to === invite2 && m.content.includes("Your private set")
    );
    const intersection = [...parseSet(p1SetMsg.content)].filter((n) => parseSet(p2SetMsg.content).has(n));

    const guess1 = await callTool(arena, "challenge_message", {
      authToken: token1,
      challengeId,
      messageType: "guess",
      content: intersection.join(", "),
    });
    assert.equal(guess1.ok, "Message sent");

    const guess2 = await callTool(arena, "challenge_message", {
      authToken: token2,
      challengeId,
      messageType: "guess",
      content: intersection.join(", "),
    });
    assert.equal(guess2.ok, "Message sent");

    assert.equal(instance.instance.state.gameEnded, true);

    const postEnd = await callTool(arena, "challenge_sync", {
      authToken: token1,
      channel: challengeId,
      index: 0,
    });
    assert.equal(postEnd.code, "SESSION_GAME_ENDED");

    await arena.close();
    await chat.close();
  });

  it("MCP error: duplicate join returns error", async () => {
    const arena = await createArenaClient();
    const createRes = await fetch(`${baseUrl}/api/challenges/psi`, { method: "POST" });
    const { invites } = await createRes.json() as { invites: string[] };

    await mcpJoin(arena, invites[0]);
    const result = await mcpJoin(arena, invites[0]);
    assert.ok(JSON.stringify(result).includes("ERR_INVITE_ALREADY_USED"));

    await arena.close();
  });

  it("MCP error: protected tools require authToken", async () => {
    const arena = await createArenaClient();
    const result = await callTool(arena, "challenge_sync", {
      channel: "nonexistent",
      index: 0,
    });
    assert.equal(result.code, "AUTH_REQUIRED");
    await arena.close();
  });

  it("MCP invites channel remains readable without auth token", async () => {
    const chat = await createChatClient();
    await callTool(chat, "send_chat", {
      channel: "invites",
      from: "listener",
      content: "inv_foo",
    });

    const result = await callTool(chat, "sync", {
      channel: "invites",
      from: "listener",
      index: 0,
    });
    assert.ok(result.messages.some((m: any) => m.content === "inv_foo"));
    await chat.close();
  });
});
