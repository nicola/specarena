import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import app from "../server/index";
import { defaultEngine } from "../engine";
import { readNextSSEData } from "./helpers/sse";

// --- Helpers ---

async function request(method: string, path: string, body?: object) {
  return app.request(path, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function clearState() {
  await defaultEngine.clearRuntimeState();
}

async function createPsiChallenge() {
  const res = await request("POST", "/api/challenges/psi");
  assert.equal(res.status, 200);
  return res.json();
}

async function sendChat(channel: string, from: string, content: string, to?: string) {
  const body: Record<string, string> = { channel, from, content };
  if (to) body.to = to;
  const res = await request("POST", "/api/chat/send", body);
  assert.equal(res.status, 200);
  return res.json();
}

async function sendGuess(challengeId: string, from: string, content: string) {
  const res = await request("POST", "/api/arena/message", {
    challengeId, from, messageType: "guess", content,
  });
  assert.equal(res.status, 200);
  return res.json();
}

/** Opens an SSE stream and returns a reader + buffer. */
function openSSE(channel: string) {
  const resPromise = request("GET", `/api/chat/ws/${channel}`);
  return resPromise.then((res) => {
    assert.equal(res.status, 200);
    assert.ok(res.headers.get("content-type")?.includes("text/event-stream"));
    return {
      reader: res.body!.getReader(),
      buf: { s: "" },
    };
  });
}

// --- Tests ---

describe("Concurrent SSE streams — engine level (no auth)", () => {
  beforeEach(async () => clearState());

  it("two viewers receive all messages from agents chatting", async () => {
    const { id, invites } = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: invites[0] });
    await request("POST", "/api/arena/join", { invite: invites[1] });
    const channel = `challenge_${id}`;

    // Two viewers open SSE streams
    const v1 = await openSSE(channel);
    const v2 = await openSSE(channel);

    try {
      // Both get initial event
      const init1 = await readNextSSEData(v1.reader, v1.buf);
      const init2 = await readNextSSEData(v2.reader, v2.buf);
      assert.equal(init1.type, "initial");
      assert.equal(init2.type, "initial");

      // Agents chat back and forth
      await sendChat(channel, invites[0], "Agent A: hello");
      await sendChat(channel, invites[1], "Agent B: hi back");
      await sendChat(channel, invites[0], "Agent A: how's it going?");

      // Both viewers should receive all 3 messages in order
      for (const label of ["Agent A: hello", "Agent B: hi back", "Agent A: how's it going?"]) {
        const ev1 = await readNextSSEData(v1.reader, v1.buf);
        const ev2 = await readNextSSEData(v2.reader, v2.buf);
        assert.equal(ev1.type, "new_message");
        assert.equal(ev2.type, "new_message");
        assert.equal(ev1.message.content, label);
        assert.equal(ev2.message.content, label);
      }
    } finally {
      v1.reader.cancel().catch(() => {});
      v2.reader.cancel().catch(() => {});
    }
  });

  it("viewer disconnecting doesn't break remaining viewers", async () => {
    const { id, invites } = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: invites[0] });
    await request("POST", "/api/arena/join", { invite: invites[1] });
    const channel = `challenge_${id}`;

    const v1 = await openSSE(channel);
    const v2 = await openSSE(channel);
    const v3 = await openSSE(channel);

    try {
      // All consume initial
      await readNextSSEData(v1.reader, v1.buf);
      await readNextSSEData(v2.reader, v2.buf);
      await readNextSSEData(v3.reader, v3.buf);

      // Viewer 2 disconnects
      await v2.reader.cancel();

      // Agents keep chatting — remaining viewers should still receive messages
      await sendChat(channel, invites[0], "after disconnect 1");
      await sendChat(channel, invites[1], "after disconnect 2");

      for (const content of ["after disconnect 1", "after disconnect 2"]) {
        const ev1 = await readNextSSEData(v1.reader, v1.buf);
        const ev3 = await readNextSSEData(v3.reader, v3.buf);
        assert.equal(ev1.type, "new_message");
        assert.equal(ev3.type, "new_message");
        assert.equal(ev1.message.content, content);
        assert.equal(ev3.message.content, content);
      }
    } finally {
      v1.reader.cancel().catch(() => {});
      v2.reader.cancel().catch(() => {});
      v3.reader.cancel().catch(() => {});
    }
  });

  it("rapid back-and-forth between agents — all messages arrive in order", async () => {
    const { id, invites } = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: invites[0] });
    await request("POST", "/api/arena/join", { invite: invites[1] });
    const channel = `challenge_${id}`;

    const viewer = await openSSE(channel);

    try {
      await readNextSSEData(viewer.reader, viewer.buf);

      // 10 rapid messages alternating between agents
      const expected: string[] = [];
      for (let i = 0; i < 10; i++) {
        const from = invites[i % 2];
        const content = `turn-${i}`;
        expected.push(content);
        await sendChat(channel, from, content);
      }

      // All 10 arrive in order
      for (let i = 0; i < 10; i++) {
        const ev = await readNextSSEData(viewer.reader, viewer.buf);
        assert.equal(ev.type, "new_message");
        assert.equal(ev.message.content, expected[i], `message ${i} should be in order`);
      }
    } finally {
      viewer.reader.cancel().catch(() => {});
    }
  });

  it("SSE stays in sync while agents play a full game", async () => {
    const { id, invites } = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: invites[0] });
    await request("POST", "/api/arena/join", { invite: invites[1] });
    const channel = `challenge_${id}`;

    const viewer = await openSSE(channel);

    try {
      const init = await readNextSSEData(viewer.reader, viewer.buf);
      assert.equal(init.type, "initial");
      assert.ok(init.messages.length > 0, "initial batch should have operator messages");

      // Agents chat before guessing
      await sendChat(channel, invites[0], "I think the answer is 100");
      await sendChat(channel, invites[1], "Let me think...");
      await sendChat(channel, invites[1], "I'll guess 100 too");

      // Read the 3 chat messages
      const chatMessages: any[] = [];
      for (let i = 0; i < 3; i++) {
        const ev = await readNextSSEData(viewer.reader, viewer.buf);
        assert.equal(ev.type, "new_message");
        chatMessages.push(ev.message);
      }
      assert.equal(chatMessages[0].content, "I think the answer is 100");
      assert.equal(chatMessages[1].content, "Let me think...");
      assert.equal(chatMessages[2].content, "I'll guess 100 too");

      // Both agents submit guesses — game ends
      await sendGuess(id, invites[0], "100");
      await sendGuess(id, invites[1], "100");

      // Verify game ended via engine state
      const ch = await defaultEngine.getChallenge(id);
      assert.equal(ch?.instance?.state?.gameEnded, true, "game should be ended");
    } finally {
      viewer.reader.cancel().catch(() => {});
    }
  });

  // --- Cross-challenge concurrency (the "two pages open" scenario) ---

  it("SSE streams on two different challenges receive their own messages independently", async () => {
    const c1 = await createPsiChallenge();
    const c2 = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: c1.invites[0] });
    await request("POST", "/api/arena/join", { invite: c1.invites[1] });
    await request("POST", "/api/arena/join", { invite: c2.invites[0] });
    await request("POST", "/api/arena/join", { invite: c2.invites[1] });

    // Simulate two challenge pages: each opens bare + prefixed streams (4 total)
    const v1bare = await openSSE(c1.id);
    const v1pref = await openSSE(`challenge_${c1.id}`);
    const v2bare = await openSSE(c2.id);
    const v2pref = await openSSE(`challenge_${c2.id}`);

    try {
      // Consume initial events on all 4 streams
      await readNextSSEData(v1bare.reader, v1bare.buf);
      await readNextSSEData(v1pref.reader, v1pref.buf);
      await readNextSSEData(v2bare.reader, v2bare.buf);
      await readNextSSEData(v2pref.reader, v2pref.buf);

      // Send a message on challenge 1's prefixed channel
      await sendChat(`challenge_${c1.id}`, c1.invites[0], "hello from c1");

      // Only the prefixed stream for c1 should receive it (bare c1 is on a different channel)
      const ev1pref = await readNextSSEData(v1pref.reader, v1pref.buf);
      assert.equal(ev1pref.type, "new_message");
      assert.equal(ev1pref.message.content, "hello from c1");

      // Send a message on challenge 2's prefixed channel
      await sendChat(`challenge_${c2.id}`, c2.invites[0], "hello from c2");

      const ev2pref = await readNextSSEData(v2pref.reader, v2pref.buf);
      assert.equal(ev2pref.type, "new_message");
      assert.equal(ev2pref.message.content, "hello from c2");

      // Challenge 2's stream should NOT have received challenge 1's message
      // (and vice versa) — verified by the fact we read exactly what we expected above
    } finally {
      v1bare.reader.cancel().catch(() => {});
      v1pref.reader.cancel().catch(() => {});
      v2bare.reader.cancel().catch(() => {});
      v2pref.reader.cancel().catch(() => {});
    }
  });

  it("game ending on one challenge doesn't affect streams on another challenge", async () => {
    const c1 = await createPsiChallenge();
    const c2 = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: c1.invites[0] });
    await request("POST", "/api/arena/join", { invite: c1.invites[1] });
    await request("POST", "/api/arena/join", { invite: c2.invites[0] });
    await request("POST", "/api/arena/join", { invite: c2.invites[1] });

    // Open stream on challenge 2
    const v2pref = await openSSE(`challenge_${c2.id}`);

    try {
      await readNextSSEData(v2pref.reader, v2pref.buf);

      // End challenge 1
      await sendGuess(c1.id, c1.invites[0], "100");
      await sendGuess(c1.id, c1.invites[1], "100");

      // Verify challenge 1 ended via engine state
      const ch1 = await defaultEngine.getChallenge(c1.id);
      assert.equal(ch1?.instance?.state?.gameEnded, true, "c1 should be ended");

      // Challenge 2 stream should still be alive — send a message and verify
      await sendChat(`challenge_${c2.id}`, c2.invites[0], "c2 still alive");

      const ev2pref = await readNextSSEData(v2pref.reader, v2pref.buf);
      assert.equal(ev2pref.type, "new_message");
      assert.equal(ev2pref.message.content, "c2 still alive");
    } finally {
      v2pref.reader.cancel().catch(() => {});
    }
  });

  it("game_ended event is broadcast to live viewers on both channels", async () => {
    const { id, invites } = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: invites[0] });
    await request("POST", "/api/arena/join", { invite: invites[1] });

    const vBare = await openSSE(id);
    const vPrefixed = await openSSE(`challenge_${id}`);

    try {
      await readNextSSEData(vBare.reader, vBare.buf);
      await readNextSSEData(vPrefixed.reader, vPrefixed.buf);

      // End the game
      await sendGuess(id, invites[0], "100");
      await sendGuess(id, invites[1], "100");

      // Drain new_message events until we find game_ended on each stream
      const findGameEnded = async (reader: any, buf: any) => {
        for (let i = 0; i < 10; i++) {
          const ev = await readNextSSEData(reader, buf);
          if (ev.type === "game_ended") return ev;
        }
        throw new Error("game_ended not found");
      };

      const [endedBare, endedPrefixed] = await Promise.all([
        findGameEnded(vBare.reader, vBare.buf),
        findGameEnded(vPrefixed.reader, vPrefixed.buf),
      ]);

      // Both should have structured scores and players
      for (const ev of [endedBare, endedPrefixed]) {
        assert.equal(ev.type, "game_ended");
        assert.ok(Array.isArray(ev.scores), "scores should be an array");
        assert.equal(ev.scores.length, 2);
        assert.ok(typeof ev.scores[0].security === "number");
        assert.ok(typeof ev.scores[0].utility === "number");
        assert.ok(Array.isArray(ev.players));
        assert.equal(ev.players.length, 2);
      }
    } finally {
      vBare.reader.cancel().catch(() => {});
      vPrefixed.reader.cancel().catch(() => {});
    }
  });

  it("late viewer connecting after game ended gets game_ended in SSE stream", async () => {
    const { id, invites } = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: invites[0] });
    await request("POST", "/api/arena/join", { invite: invites[1] });

    // End the game first
    await sendGuess(id, invites[0], "100");
    await sendGuess(id, invites[1], "100");

    const ch = await defaultEngine.getChallenge(id);
    assert.equal(ch?.instance?.state?.gameEnded, true);

    // Late viewer connects
    const viewer = await openSSE(`challenge_${id}`);

    try {
      const init = await readNextSSEData(viewer.reader, viewer.buf);
      assert.equal(init.type, "initial");

      const ended = await readNextSSEData(viewer.reader, viewer.buf);
      assert.equal(ended.type, "game_ended");
      assert.ok(Array.isArray(ended.scores));
      assert.equal(ended.scores.length, 2);
      assert.ok(Array.isArray(ended.players));
    } finally {
      viewer.reader.cancel().catch(() => {});
    }
  });

  it("stream stays open after game_ended — no stream closure", async () => {
    const { id, invites } = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: invites[0] });
    await request("POST", "/api/arena/join", { invite: invites[1] });

    const viewer = await openSSE(`challenge_${id}`);

    try {
      await readNextSSEData(viewer.reader, viewer.buf);

      // End the game
      await sendGuess(id, invites[0], "100");
      await sendGuess(id, invites[1], "100");

      // Drain until game_ended
      let gameEndedSeen = false;
      for (let i = 0; i < 10; i++) {
        const ev = await readNextSSEData(viewer.reader, viewer.buf);
        if (ev.type === "game_ended") { gameEndedSeen = true; break; }
      }
      assert.ok(gameEndedSeen, "game_ended must be received");

      // Stream should still be open — reader.read() should not resolve with done:true
      const { done } = await Promise.race([
        viewer.reader.read(),
        new Promise<{ done: false; value: undefined }>((res) =>
          setTimeout(() => res({ done: false, value: undefined }), 500)
        ),
      ]);
      assert.equal(done, false, "stream must remain open after game_ended");
    } finally {
      viewer.reader.cancel().catch(() => {});
    }
  });

  it("messages interleaved across two challenges arrive correctly", async () => {
    const c1 = await createPsiChallenge();
    const c2 = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: c1.invites[0] });
    await request("POST", "/api/arena/join", { invite: c1.invites[1] });
    await request("POST", "/api/arena/join", { invite: c2.invites[0] });
    await request("POST", "/api/arena/join", { invite: c2.invites[1] });

    const v1 = await openSSE(`challenge_${c1.id}`);
    const v2 = await openSSE(`challenge_${c2.id}`);

    try {
      await readNextSSEData(v1.reader, v1.buf);
      await readNextSSEData(v2.reader, v2.buf);

      // Interleave messages across challenges
      await sendChat(`challenge_${c1.id}`, c1.invites[0], "c1-msg-0");
      await sendChat(`challenge_${c2.id}`, c2.invites[0], "c2-msg-0");
      await sendChat(`challenge_${c1.id}`, c1.invites[1], "c1-msg-1");
      await sendChat(`challenge_${c2.id}`, c2.invites[1], "c2-msg-1");
      await sendChat(`challenge_${c1.id}`, c1.invites[0], "c1-msg-2");
      await sendChat(`challenge_${c2.id}`, c2.invites[0], "c2-msg-2");

      // Each viewer gets only their challenge's messages, in order
      for (let i = 0; i < 3; i++) {
        const ev1 = await readNextSSEData(v1.reader, v1.buf);
        assert.equal(ev1.message.content, `c1-msg-${i}`);
        const ev2 = await readNextSSEData(v2.reader, v2.buf);
        assert.equal(ev2.message.content, `c2-msg-${i}`);
      }
    } finally {
      v1.reader.cancel().catch(() => {});
      v2.reader.cancel().catch(() => {});
    }
  });

});
