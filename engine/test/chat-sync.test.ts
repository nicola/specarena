import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { ChatEngine } from "../chat/ChatEngine";
import { InMemoryChatStorageAdapter } from "../storage/InMemoryChatStorageAdapter";

describe("ChatEngine syncChannel", () => {
  let chat: ChatEngine;

  beforeEach(() => {
    chat = new ChatEngine({
      storageAdapter: new InMemoryChatStorageAdapter(),
    });
  });

  it("sync from index 0 returns all messages", async () => {
    await chat.sendMessage("ch1", "alice", "first");
    await chat.sendMessage("ch1", "bob", "second");
    await chat.sendMessage("ch1", "alice", "third");

    const { messages, count } = await chat.chatSync("ch1", null, 0);
    assert.equal(count, 3);
    assert.equal(messages[0].content, "first");
    assert.equal(messages[0].index, 1);
    assert.equal(messages[1].content, "second");
    assert.equal(messages[2].content, "third");
  });

  it("sync from index 1 returns all messages (1-based indexing)", async () => {
    await chat.sendMessage("ch1", "alice", "first");
    await chat.sendMessage("ch1", "bob", "second");

    const { messages, count } = await chat.chatSync("ch1", null, 1);
    assert.equal(count, 2);
    assert.equal(messages[0].content, "first");
    assert.equal(messages[0].index, 1);
    assert.equal(messages[1].content, "second");
    assert.equal(messages[1].index, 2);
  });

  it("sync from index 2 skips the first message", async () => {
    await chat.sendMessage("ch1", "alice", "first");
    await chat.sendMessage("ch1", "bob", "second");
    await chat.sendMessage("ch1", "alice", "third");

    const { messages, count } = await chat.chatSync("ch1", null, 2);
    assert.equal(count, 2);
    assert.equal(messages[0].content, "second");
    assert.equal(messages[0].index, 2);
  });

  it("sync from empty channel returns empty array", async () => {
    const { messages, count } = await chat.chatSync("empty", null, 0);
    assert.equal(count, 0);
    assert.deepEqual(messages, []);
  });

  it("sync from empty channel with index 1 returns empty array", async () => {
    const { messages, count } = await chat.chatSync("empty", null, 1);
    assert.equal(count, 0);
    assert.deepEqual(messages, []);
  });

  it("sync with negative index is clamped to 0 and returns all messages", async () => {
    await chat.sendMessage("ch1", "alice", "first");
    await chat.sendMessage("ch1", "bob", "second");

    const { messages, count } = await chat.chatSync("ch1", null, -5);
    assert.equal(count, 2);
    assert.equal(messages[0].content, "first");
    assert.equal(messages[1].content, "second");
  });

  it("sync with fractional index is floored", async () => {
    await chat.sendMessage("ch1", "alice", "first");
    await chat.sendMessage("ch1", "bob", "second");
    await chat.sendMessage("ch1", "alice", "third");

    // 1.9 floors to 1, so should return messages with index >= 1 (all)
    const { messages, count } = await chat.chatSync("ch1", null, 1.9);
    assert.equal(count, 3);

    // 2.5 floors to 2, so should return messages with index >= 2
    const { messages: msgs2, count: count2 } = await chat.chatSync("ch1", null, 2.5);
    assert.equal(count2, 2);
    assert.equal(msgs2[0].index, 2);
  });

  it("sync with index beyond last message returns empty", async () => {
    await chat.sendMessage("ch1", "alice", "first");
    await chat.sendMessage("ch1", "bob", "second");

    const { messages, count } = await chat.chatSync("ch1", null, 100);
    assert.equal(count, 0);
    assert.deepEqual(messages, []);
  });
});
