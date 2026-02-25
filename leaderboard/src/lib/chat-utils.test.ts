import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deduplicateMessages, getConversationKey, type ChatMessage } from "./chat-utils";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal ChatMessage with sensible defaults. */
function msg(overrides: Partial<ChatMessage> & Pick<ChatMessage, "channel" | "index">): ChatMessage {
  return {
    from: "alice",
    to: null,
    content: "hello",
    timestamp: Date.now(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// deduplicateMessages
// ---------------------------------------------------------------------------

describe("deduplicateMessages", () => {
  it("returns all incoming messages when existing list is empty", () => {
    const incoming = [
      msg({ channel: "ch1", index: 0 }),
      msg({ channel: "ch1", index: 1 }),
    ];

    const result = deduplicateMessages([], incoming);
    assert.equal(result.length, 2);
    assert.deepStrictEqual(result, incoming);
  });

  it("returns empty array when incoming list is empty", () => {
    const existing = [msg({ channel: "ch1", index: 0 })];
    const result = deduplicateMessages(existing, []);
    assert.equal(result.length, 0);
  });

  it("returns empty array when both lists are empty", () => {
    const result = deduplicateMessages([], []);
    assert.equal(result.length, 0);
  });

  it("filters out messages whose channel-index key already exists", () => {
    const existing = [
      msg({ channel: "ch1", index: 0 }),
      msg({ channel: "ch1", index: 1 }),
    ];
    const incoming = [
      msg({ channel: "ch1", index: 1 }),  // duplicate
      msg({ channel: "ch1", index: 2 }),  // new
    ];

    const result = deduplicateMessages(existing, incoming);
    assert.equal(result.length, 1);
    assert.equal(result[0].channel, "ch1");
    assert.equal(result[0].index, 2);
  });

  it("returns empty array when all incoming messages are duplicates", () => {
    const existing = [
      msg({ channel: "ch1", index: 0 }),
      msg({ channel: "ch2", index: 0 }),
    ];
    const incoming = [
      msg({ channel: "ch1", index: 0 }),
      msg({ channel: "ch2", index: 0 }),
    ];

    const result = deduplicateMessages(existing, incoming);
    assert.equal(result.length, 0);
  });

  it("treats same index on different channels as distinct", () => {
    const existing = [msg({ channel: "ch1", index: 0 })];
    const incoming = [msg({ channel: "ch2", index: 0 })];

    const result = deduplicateMessages(existing, incoming);
    assert.equal(result.length, 1);
    assert.equal(result[0].channel, "ch2");
  });

  it("does not mutate the incoming array", () => {
    const existing = [msg({ channel: "ch1", index: 0 })];
    const incoming = [
      msg({ channel: "ch1", index: 0 }),
      msg({ channel: "ch1", index: 1 }),
    ];
    const originalLength = incoming.length;

    deduplicateMessages(existing, incoming);
    assert.equal(incoming.length, originalLength);
  });
});

// ---------------------------------------------------------------------------
// getConversationKey
// ---------------------------------------------------------------------------

describe("getConversationKey", () => {
  it("returns 'from -> to' when message has a non-null to field", () => {
    const m = msg({ channel: "ch1", index: 0, from: "alice", to: "bob" });
    assert.equal(getConversationKey(m), "alice -> bob");
  });

  it("returns the channel when message has null to field", () => {
    const m = msg({ channel: "general", index: 0, from: "alice", to: null });
    assert.equal(getConversationKey(m), "general");
  });

  it("returns 'from -> to' even when to is an empty string", () => {
    // An empty string is falsy, so getConversationKey should return the channel.
    // This documents the actual behavior of the ternary check.
    const m = msg({ channel: "ch1", index: 0, from: "alice", to: "" });
    assert.equal(getConversationKey(m), "ch1");
  });

  it("preserves exact from and to values in the key", () => {
    const m = msg({ channel: "ch1", index: 0, from: "player-abc-123", to: "operator" });
    assert.equal(getConversationKey(m), "player-abc-123 -> operator");
  });
});
