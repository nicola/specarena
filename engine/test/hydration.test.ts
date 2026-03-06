import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createEngine, InMemoryArenaStorageAdapter } from "../engine";
import type { ChallengeFactoryContext, ChallengeOperator, ChatMessage, Score } from "../types";

function freshScores(playerCount: number): Score[] {
  return Array.from({ length: playerCount }, () => ({ security: 0, utility: 0 }));
}

function createRestorableChallenge(
  challengeId: string,
  _options?: Record<string, unknown>,
  _context?: ChallengeFactoryContext,
): ChallengeOperator {
  return {
    state: {
      gameStarted: false,
      gameEnded: false,
      scores: freshScores(2),
      players: [],
      playerIdentities: {},
    },
    secret: `fresh:${challengeId}`,
    restoreCalls: 0,
    async join() {},
    async message(_message: ChatMessage) {},
    restoreState(savedState: unknown) {
      this.restoreCalls += 1;
      this.secret = (savedState as { secret: string }).secret;
    },
    saveState() {
      return { secret: this.secret };
    },
  } as ChallengeOperator & { secret: string; restoreCalls: number };
}

describe("ArenaEngine hydration", () => {
  it("restores operator state and private state into a fresh challenge instance", async () => {
    const storageAdapter = new InMemoryArenaStorageAdapter();
    const engine = createEngine({ storageAdapter });
    engine.registerChallengeFactory("restore-test", createRestorableChallenge);

    const created = await engine.createChallenge("restore-test");
    const stored = await storageAdapter.getChallenge(created.id);
    assert.ok(stored);

    stored.state = {
      gameStarted: true,
      gameEnded: false,
      scores: freshScores(2),
      players: [created.invites[0]],
      playerIdentities: { [created.invites[0]]: "user-alice" },
    };
    stored.privateState = { secret: "restored-secret" };
    await storageAdapter.setChallenge(stored);

    const runtime = await engine.hydrateChallenge(created.id);
    assert.ok(runtime);
    assert.equal(runtime.instance.state.gameStarted, true);
    assert.deepEqual(runtime.instance.state.players, [created.invites[0]]);
    assert.deepEqual(runtime.instance.state.playerIdentities, { [created.invites[0]]: "user-alice" });
    assert.equal((runtime.instance as any).secret, "restored-secret");
    assert.equal((runtime.instance as any).restoreCalls, 1);
    assert.deepEqual(runtime.instance.saveState?.(), { secret: "restored-secret" });
  });
});
