import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { InMemoryScoringStore } from "../store";

describe("InMemoryScoringStore transactions", () => {
  it("serializes concurrent read-modify-write updates", async () => {
    const store = new InMemoryScoringStore();
    const updates = 50;

    await Promise.all(
      Array.from({ length: updates }, () => store.transaction(async (tx) => {
        const prev = (await tx.getGlobalStrategyState<number>("counter")) ?? 0;
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        await tx.setGlobalStrategyState("counter", prev + 1);
      })),
    );

    await store.waitForIdle();
    const value = await store.getGlobalStrategyState<number>("counter");
    assert.equal(value, updates);
  });
});
