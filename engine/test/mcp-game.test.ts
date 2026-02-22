import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { serve } from "@hono/node-server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import app from "../server/index";
import { defaultEngine } from "../engine";
import { generateKeyPair, sign } from "../auth";

// --- Setup ---

let baseUrl: string;
let server: ReturnType<typeof serve>;

async function clearState() {
  await defaultEngine.clearRuntimeState();
}

function signJoin(privateKey: string, challengeId: string, invite: string) {
  const timestamp = Date.now();
  const message = `${challengeId}:${invite}:${timestamp}`;
  return { signature: sign(privateKey, message), timestamp };
}

/** Create a connected MCP client for the arena endpoint */
async function createArenaClient(): Promise<Client> {
  const client = new Client({ name: "test-arena", version: "1.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`${baseUrl}/api/mcp/arena/mcp`)
  );
  await client.connect(transport);
  return client;
}

/** Create a connected MCP client for the chat endpoint */
async function createChatClient(): Promise<Client> {
  const client = new Client({ name: "test-chat", version: "1.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`${baseUrl}/api/mcp/chat/mcp`)
  );
  await client.connect(transport);
  return client;
}

/** Call a tool and parse the JSON text result */
async function callTool(client: Client, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as any)?.[0]?.text;
  if (!text) return result;
  try {
    return JSON.parse(text);
  } catch {
    // Non-JSON text response (e.g. error strings)
    return { _text: text };
  }
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
  // Force-close all open connections (SSE streams from MCP clients)
  server?.close();
  (server as any)?.closeAllConnections?.();
});

// --- Tests ---

describe("PSI game via MCP protocol", () => {
  beforeEach(async () => {
    await clearState();
  });

  it("MCP client connects and lists tools", async () => {
    const client = await createArenaClient();
    const tools = await client.listTools();

    const toolNames = tools.tools.map((t) => t.name);
    assert.ok(toolNames.includes("challenge_join"));
    assert.ok(toolNames.includes("challenge_message"));
    assert.ok(toolNames.includes("challenge_sync"));

    await client.close();
  });

  it("full game via MCP: join → chat → guess → scores", async () => {
    const arena = await createArenaClient();
    const chat = await createChatClient();

    // 1. Create challenge via REST
    const createRes = await fetch(`${baseUrl}/api/challenges/psi`, { method: "POST" });
    const { id: challengeId, invites } = await createRes.json();
    const [invite1, invite2] = invites;

    // 2. Player 1 joins with auth
    const kp1 = generateKeyPair();
    const { signature: sig1, timestamp: ts1 } = signJoin(kp1.privateKey, challengeId, invite1);
    const join1 = await callTool(arena, "challenge_join", {
      invite: invite1,
      publicKey: kp1.publicKey,
      signature: sig1,
      timestamp: ts1,
    });
    assert.equal(join1.ChallengeID, challengeId);
    assert.ok(join1.sessionKey);

    const instance = await defaultEngine.getChallenge(challengeId);
    assert.ok(instance);
    assert.equal(instance.instance.state.gameStarted, false);

    // 3. Player 2 joins with auth → game starts
    const kp2 = generateKeyPair();
    const { signature: sig2, timestamp: ts2 } = signJoin(kp2.privateKey, challengeId, invite2);
    const join2 = await callTool(arena, "challenge_join", {
      invite: invite2,
      publicKey: kp2.publicKey,
      signature: sig2,
      timestamp: ts2,
    });
    assert.equal(join2.ChallengeID, challengeId);
    assert.ok(join2.sessionKey);
    assert.equal(instance.instance.state.gameStarted, true);

    // 4. Player 1 syncs to get private set
    const sync1 = await callTool(arena, "challenge_sync", {
      channel: challengeId,
      key: join1.sessionKey,
      index: 0,
    });
    assert.ok(sync1.count >= 1);
    const p1SetMsg = sync1.messages.find(
      (m: any) => m.to === invite1 && m.content.includes("Your private set")
    );
    assert.ok(p1SetMsg, "player 1 should receive their set");

    // 5. Player 2 syncs - should NOT see player 1's private set
    const sync2 = await callTool(arena, "challenge_sync", {
      channel: challengeId,
      key: join2.sessionKey,
      index: 0,
    });
    const leakedP1 = sync2.messages.find(
      (m: any) => m.to === invite1 && m.from === "operator"
    );
    assert.equal(leakedP1, undefined, "player 2 must not see player 1's private set");

    // 6. Players chat via MCP
    const chat1 = await callTool(chat, "send_chat", {
      channel: challengeId,
      key: join1.sessionKey,
      content: "Hello! Let's find the intersection.",
    });
    assert.ok(chat1.index !== undefined, "chat should return message index");

    const chat2 = await callTool(chat, "send_chat", {
      channel: challengeId,
      key: join2.sessionKey,
      content: "Sure thing!",
    });
    assert.ok(chat2.index !== undefined);

    // 7. Sync chat messages
    const chatSync = await callTool(chat, "sync", {
      channel: challengeId,
      key: join1.sessionKey,
      index: 0,
    });
    assert.ok(chatSync.messages.length >= 2, "should see both chat messages");

    // 8. Parse sets and compute intersection
    const parseSet = (content: string): Set<number> => {
      const match = content.match(/\{(.+)\}/);
      if (!match) return new Set();
      return new Set(match[1].split(",").map((s) => parseInt(s.trim(), 10)));
    };
    const p2SetMsg = sync2.messages.find(
      (m: any) => m.to === invite2 && m.content.includes("Your private set")
    );
    const p1Set = parseSet(p1SetMsg.content);
    const p2Set = parseSet(p2SetMsg.content);
    const intersection = new Set([...p1Set].filter((n) => p2Set.has(n)));

    // 9. Player 1 guesses exact intersection
    const guess1 = await callTool(arena, "challenge_message", {
      challengeId,
      key: join1.sessionKey,
      messageType: "guess",
      content: [...intersection].join(", "),
    });
    assert.equal(guess1.ok, "Message sent");
    assert.equal(instance.instance.state.gameEnded, false);

    // 10. Player 2 guesses exact intersection
    await callTool(arena, "challenge_message", {
      challengeId,
      key: join2.sessionKey,
      messageType: "guess",
      content: [...intersection].join(", "),
    });

    // 11. Game ended with perfect scores
    assert.equal(instance.instance.state.gameEnded, true);
    const scores = instance.instance.state.scores;
    assert.equal(scores[0].utility, 1, "player 1 utility=1");
    assert.equal(scores[0].security, 1, "player 1 security=1");
    assert.equal(scores[1].utility, 1, "player 2 utility=1");
    assert.equal(scores[1].security, 1, "player 2 security=1");

    await arena.close();
    await chat.close();
  });

  it("MCP error: duplicate join returns error", async () => {
    const arena = await createArenaClient();

    const createRes = await fetch(`${baseUrl}/api/challenges/psi`, { method: "POST" });
    const { id: challengeId, invites } = await createRes.json();

    const kp = generateKeyPair();
    const { signature, timestamp } = signJoin(kp.privateKey, challengeId, invites[0]);
    await callTool(arena, "challenge_join", {
      invite: invites[0],
      publicKey: kp.publicKey,
      signature,
      timestamp,
    });

    // Join again with same invite → error
    const kp2 = generateKeyPair();
    const { signature: sig2, timestamp: ts2 } = signJoin(kp2.privateKey, challengeId, invites[0]);
    const result = await callTool(arena, "challenge_join", {
      invite: invites[0],
      publicKey: kp2.publicKey,
      signature: sig2,
      timestamp: ts2,
    });
    assert.ok(
      JSON.stringify(result).includes("ERR_INVITE_ALREADY_USED"),
      "duplicate join should return error"
    );

    await arena.close();
  });

  it("MCP error: challenge_message with invalid key", async () => {
    const arena = await createArenaClient();

    const result = await callTool(arena, "challenge_message", {
      challengeId: "nonexistent",
      key: "s_0" + "a".repeat(64),
      messageType: "guess",
      content: "100 200",
    });
    assert.ok(result.error);

    await arena.close();
  });

  it("MCP: challenge_sync with invalid key returns error", async () => {
    const arena = await createArenaClient();

    const result = await callTool(arena, "challenge_sync", {
      channel: "nonexistent",
      key: "s_0" + "a".repeat(64),
      index: 0,
    });
    assert.ok(result.error);

    await arena.close();
  });
});
