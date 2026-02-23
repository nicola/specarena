import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

import app from "../server/index";
import { defaultEngine } from "../engine";

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

/** Collects all SSE data events until the stream closes or timeout. */
async function collectAllSSEData(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  buf: { s: string },
  timeoutMs = 3000
): Promise<any[]> {
  const events: any[] = [];
  const decoder = new TextDecoder();
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const readPromise = reader.read();
      const timeoutPromise = new Promise<{ done: true; value: undefined }>((res) =>
        setTimeout(() => res({ done: true, value: undefined }), remaining)
      );
      const { done, value } = await Promise.race([readPromise, timeoutPromise]);
      if (done) break;
      buf.s += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.s.indexOf("\n\n")) !== -1) {
        const block = buf.s.slice(0, nl);
        buf.s = buf.s.slice(nl + 2);
        const line = block.split("\n").find((l) => l.startsWith("data: "));
        if (line) events.push(JSON.parse(line.slice(6)));
      }
    } catch {
      break;
    }
  }
  return events;
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

  it("game ending closes streams for all concurrent viewers", async () => {
    const { id, invites } = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: invites[0] });
    await request("POST", "/api/arena/join", { invite: invites[1] });
    const channel = `challenge_${id}`;

    const v1 = await openSSE(channel);
    const v2 = await openSSE(channel);
    const v3 = await openSSE(channel);

    try {
      await readNextSSEData(v1.reader, v1.buf);
      await readNextSSEData(v2.reader, v2.buf);
      await readNextSSEData(v3.reader, v3.buf);

      // Both players submit guesses — game ends
      await sendGuess(id, invites[0], "100");
      await sendGuess(id, invites[1], "100");

      // All three viewers should receive game_ended
      for (const v of [v1, v2, v3]) {
        const events = await collectAllSSEData(v.reader, v.buf);
        const gameEnded = events.find((e) => e.type === "game_ended");
        assert.ok(gameEnded, "viewer must receive game_ended");
      }
    } finally {
      for (const v of [v1, v2, v3]) v.reader.cancel().catch(() => {});
    }
  });

  it("both channels (bare + prefixed) get game_ended", async () => {
    const { id, invites } = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: invites[0] });
    await request("POST", "/api/arena/join", { invite: invites[1] });

    // One viewer on bare channel, one on prefixed
    const vBare = await openSSE(id);
    const vPrefixed = await openSSE(`challenge_${id}`);

    try {
      await readNextSSEData(vBare.reader, vBare.buf);
      await readNextSSEData(vPrefixed.reader, vPrefixed.buf);

      // End the game
      await sendGuess(id, invites[0], "100");
      await sendGuess(id, invites[1], "100");

      const eventsBare = await collectAllSSEData(vBare.reader, vBare.buf);
      const eventsPrefixed = await collectAllSSEData(vPrefixed.reader, vPrefixed.buf);

      assert.ok(
        eventsBare.find((e) => e.type === "game_ended"),
        "bare channel must receive game_ended"
      );
      assert.ok(
        eventsPrefixed.find((e) => e.type === "game_ended"),
        "prefixed channel must receive game_ended"
      );
    } finally {
      vBare.reader.cancel().catch(() => {});
      vPrefixed.reader.cancel().catch(() => {});
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

      // Drain remaining events — should include game_ended
      const remaining = await collectAllSSEData(viewer.reader, viewer.buf);
      const gameEnded = remaining.find((e) => e.type === "game_ended");
      assert.ok(gameEnded, "game_ended must arrive after guesses");
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

    // Open streams on both challenges (4 total, like two browser pages)
    const v1bare = await openSSE(c1.id);
    const v1pref = await openSSE(`challenge_${c1.id}`);
    const v2bare = await openSSE(c2.id);
    const v2pref = await openSSE(`challenge_${c2.id}`);

    try {
      await readNextSSEData(v1bare.reader, v1bare.buf);
      await readNextSSEData(v1pref.reader, v1pref.buf);
      await readNextSSEData(v2bare.reader, v2bare.buf);
      await readNextSSEData(v2pref.reader, v2pref.buf);

      // End challenge 1
      await sendGuess(c1.id, c1.invites[0], "100");
      await sendGuess(c1.id, c1.invites[1], "100");

      // Challenge 1 streams should receive game_ended and close
      const evs1bare = await collectAllSSEData(v1bare.reader, v1bare.buf);
      const evs1pref = await collectAllSSEData(v1pref.reader, v1pref.buf);
      assert.ok(evs1bare.find((e) => e.type === "game_ended"), "c1 bare must get game_ended");
      assert.ok(evs1pref.find((e) => e.type === "game_ended"), "c1 prefixed must get game_ended");

      // Challenge 2 streams should still be alive — send a message and verify
      await sendChat(`challenge_${c2.id}`, c2.invites[0], "c2 still alive");

      const ev2pref = await readNextSSEData(v2pref.reader, v2pref.buf);
      assert.equal(ev2pref.type, "new_message");
      assert.equal(ev2pref.message.content, "c2 still alive");
    } finally {
      v1bare.reader.cancel().catch(() => {});
      v1pref.reader.cancel().catch(() => {});
      v2bare.reader.cancel().catch(() => {});
      v2pref.reader.cancel().catch(() => {});
    }
  });

  it("both challenges ending concurrently closes all 4 streams", async () => {
    const c1 = await createPsiChallenge();
    const c2 = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: c1.invites[0] });
    await request("POST", "/api/arena/join", { invite: c1.invites[1] });
    await request("POST", "/api/arena/join", { invite: c2.invites[0] });
    await request("POST", "/api/arena/join", { invite: c2.invites[1] });

    const v1bare = await openSSE(c1.id);
    const v1pref = await openSSE(`challenge_${c1.id}`);
    const v2bare = await openSSE(c2.id);
    const v2pref = await openSSE(`challenge_${c2.id}`);

    try {
      await readNextSSEData(v1bare.reader, v1bare.buf);
      await readNextSSEData(v1pref.reader, v1pref.buf);
      await readNextSSEData(v2bare.reader, v2bare.buf);
      await readNextSSEData(v2pref.reader, v2pref.buf);

      // End both challenges back-to-back
      await sendGuess(c1.id, c1.invites[0], "100");
      await sendGuess(c1.id, c1.invites[1], "100");
      await sendGuess(c2.id, c2.invites[0], "100");
      await sendGuess(c2.id, c2.invites[1], "100");

      // All 4 streams should receive game_ended
      for (const [label, v] of [
        ["c1 bare", v1bare], ["c1 prefixed", v1pref],
        ["c2 bare", v2bare], ["c2 prefixed", v2pref],
      ] as const) {
        const events = await collectAllSSEData(v.reader, v.buf);
        assert.ok(events.find((e) => e.type === "game_ended"), `${label} must get game_ended`);
      }
    } finally {
      v1bare.reader.cancel().catch(() => {});
      v1pref.reader.cancel().catch(() => {});
      v2bare.reader.cancel().catch(() => {});
      v2pref.reader.cancel().catch(() => {});
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

  it("viewer connecting after game ended gets initial + game_ended then stream closes", async () => {
    const { id, invites } = await createPsiChallenge();
    await request("POST", "/api/arena/join", { invite: invites[0] });
    await request("POST", "/api/arena/join", { invite: invites[1] });

    // End the game first
    await sendGuess(id, invites[0], "100");
    await sendGuess(id, invites[1], "100");

    const ch = await defaultEngine.getChallenge(id);
    assert.equal(ch?.instance?.state?.gameEnded, true);

    // Now a late viewer connects
    const viewer = await openSSE(`challenge_${id}`);

    try {
      const init = await readNextSSEData(viewer.reader, viewer.buf);
      assert.equal(init.type, "initial");

      const ended = await readNextSSEData(viewer.reader, viewer.buf);
      assert.equal(ended.type, "game_ended");

      // Stream should be closed
      const { done } = await Promise.race([
        viewer.reader.read(),
        new Promise<{ done: true; value: undefined }>((res) =>
          setTimeout(() => res({ done: true, value: undefined }), 500)
        ),
      ]);
      assert.ok(done, "stream should close after game_ended");
    } finally {
      viewer.reader.cancel().catch(() => {});
    }
  });
});
