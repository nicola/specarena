import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { serve } from "@hono/node-server";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import app from "../app";
import { challenges } from "../storage/challenges";
import { messagesByChannel, indexCounters, channelSubscribers } from "../storage/chat";

// --- Setup ---

let baseUrl: string;
let server: ReturnType<typeof serve>;

function clearState() {
  challenges.clear();
  messagesByChannel.clear();
  indexCounters.clear();
  channelSubscribers.clear();
}

/** Create a connected MCP client for the arena endpoint */
async function createArenaClient(): Promise<Client> {
  const client = new Client({ name: "test-arena", version: "1.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`${baseUrl}/api/arena/mcp`)
  );
  await client.connect(transport);
  return client;
}

/** Create a connected MCP client for the chat endpoint */
async function createChatClient(): Promise<Client> {
  const client = new Client({ name: "test-chat", version: "1.0" });
  const transport = new StreamableHTTPClientTransport(
    new URL(`${baseUrl}/api/chat/mcp`)
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
  beforeEach(() => {
    clearState();
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

    // 2. Player 1 joins
    const join1 = await callTool(arena, "challenge_join", { invite: invite1 });
    assert.equal(join1.ChallengeID, challengeId);
    assert.equal(join1.ChallengeInfo.name, "Private Set Intersection");

    const instance = challenges.get(challengeId)!;
    assert.equal(instance.instance.state.gameStarted, false);

    // 3. Player 2 joins → game starts
    const join2 = await callTool(arena, "challenge_join", { invite: invite2 });
    assert.equal(join2.ChallengeID, challengeId);
    assert.equal(instance.instance.state.gameStarted, true);

    // 4. Player 1 syncs to get private set
    const sync1 = await callTool(arena, "challenge_sync", {
      channel: challengeId,
      from: invite1,
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
      from: invite2,
      index: 0,
    });
    const leakedP1 = sync2.messages.find(
      (m: any) => m.to === invite1 && m.from === "operator"
    );
    assert.equal(leakedP1, undefined, "player 2 must not see player 1's private set");

    // 6. Players chat via MCP
    const chat1 = await callTool(chat, "send_chat", {
      channel: challengeId,
      from: invite1,
      content: "Hello! Let's find the intersection.",
    });
    assert.ok(chat1.index, "chat should return message index");

    const chat2 = await callTool(chat, "send_chat", {
      channel: challengeId,
      from: invite2,
      content: "Sure thing!",
    });
    assert.ok(chat2.index);

    // 7. Sync chat messages
    const chatSync = await callTool(chat, "sync", {
      channel: challengeId,
      from: invite1,
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
      from: invite1,
      messageType: "guess",
      content: [...intersection].join(", "),
    });
    assert.equal(guess1.text, "OK: Message sent");
    assert.equal(instance.instance.state.gameEnded, false);

    // 10. Player 2 guesses exact intersection
    await callTool(arena, "challenge_message", {
      challengeId,
      from: invite2,
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
    const { invites } = await createRes.json();

    await callTool(arena, "challenge_join", { invite: invites[0] });

    // Join again with same invite → error
    const result = await callTool(arena, "challenge_join", { invite: invites[0] });
    assert.ok(
      JSON.stringify(result).includes("ERR_INVITE_ALREADY_USED"),
      "duplicate join should return error"
    );

    await arena.close();
  });

  it("MCP error: challenge_message with invalid challenge", async () => {
    const arena = await createArenaClient();

    const result = await callTool(arena, "challenge_message", {
      challengeId: "nonexistent",
      from: "nobody",
      messageType: "guess",
      content: "100 200",
    });
    assert.equal(result.error, "Challenge not found");

    await arena.close();
  });

  it("MCP: challenge_sync returns empty for new channel", async () => {
    const arena = await createArenaClient();

    const result = await callTool(arena, "challenge_sync", {
      channel: "nonexistent",
      from: "nobody",
      index: 0,
    });
    assert.equal(result.count, 0);
    assert.deepEqual(result.messages, []);

    await arena.close();
  });
});
