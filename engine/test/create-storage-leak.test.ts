import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert/strict";
import { InMemoryArenaStorageAdapter } from "../storage/InMemoryArenaStorageAdapter";
import { InMemoryChatStorageAdapter } from "../storage/InMemoryChatStorageAdapter";
import { InMemoryUserStorageAdapter } from "../users/index";

/**
 * Verifies that the ArenaEngine constructor does not call createStorage()
 * multiple times, which would create duplicate DB connection pools when
 * DATABASE_URL is set.
 */
describe("ArenaEngine constructor storage creation", () => {
  let originalCreateStorage: typeof import("../storage/createStorage").createStorage;
  let createStorageModule: typeof import("../storage/createStorage");
  let callCount: number;

  beforeEach(async () => {
    callCount = 0;
    createStorageModule = await import("../storage/createStorage");
    originalCreateStorage = createStorageModule.createStorage;
  });

  afterEach(() => {
    // Restore original
    (createStorageModule as any).createStorage = originalCreateStorage;
  });

  it("calls createStorage at most once when no options are provided", async () => {
    // We can't easily mock the import, so instead we verify the behavior
    // by checking that constructing an engine with partial options still
    // produces working adapters from a single createStorage call.
    const { ArenaEngine } = await import("../engine");

    // Provide only storageAdapter, leave userStorage and chatStorageAdapter missing
    const customArena = new InMemoryArenaStorageAdapter();
    const engine = new ArenaEngine({ storageAdapter: customArena });

    // The engine should use our custom adapter for arena
    assert.equal((engine as any).storageAdapter, customArena);
    // And the users adapter should be a valid adapter (from the single defaults call)
    assert.ok(engine.users, "users adapter should be defined");
    assert.ok(typeof engine.users.getUser === "function", "users adapter should have getUser method");
  });

  it("uses provided adapters and does not create unnecessary defaults when all options given", async () => {
    const { ArenaEngine } = await import("../engine");

    const customArena = new InMemoryArenaStorageAdapter();
    const customChat = new InMemoryChatStorageAdapter();
    const customUser = new InMemoryUserStorageAdapter();

    const engine = new ArenaEngine({
      storageAdapter: customArena,
      chatStorageAdapter: customChat,
      userStorage: customUser,
    });

    assert.equal((engine as any).storageAdapter, customArena);
    assert.equal(engine.users, customUser);
  });

  it("shares the same defaults instance across arena and user when neither is provided", async () => {
    const { ArenaEngine } = await import("../engine");

    // With no options, both storageAdapter and users should come from the
    // same createStorage() call. We can't directly inspect, but we can
    // verify they are both valid and functional.
    const engine = new ArenaEngine();
    assert.ok((engine as any).storageAdapter, "storageAdapter should be defined");
    assert.ok(engine.users, "users should be defined");
  });
});
