import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { globalAverage } from "../global-average";
import type { ScoringEntry } from "@arena/engine/scoring/types";

describe("global-average strategy", () => {
  it("returns empty for no per-challenge data", () => {
    const entries = globalAverage.compute({});
    assert.deepStrictEqual(entries, []);
  });

  it("single challenge type — passes through as-is", () => {
    const entries = globalAverage.compute({
      psi: [
        { playerId: "alice", gamesPlayed: 2, security: 1, utility: 1 },
        { playerId: "bob", gamesPlayed: 2, security: -1, utility: -1 },
      ],
    });

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    assert.equal(alice.security, 1);
    assert.equal(alice.utility, 1);
    assert.equal(alice.gamesPlayed, 2);

    assert.equal(bob.security, -1);
    assert.equal(bob.utility, -1);
    assert.equal(bob.gamesPlayed, 2);
  });

  it("two challenge types — averages across challenges", () => {
    const entries = globalAverage.compute({
      psi: [
        { playerId: "alice", gamesPlayed: 2, security: 1, utility: 1 },
        { playerId: "bob", gamesPlayed: 2, security: -1, utility: -1 },
      ],
      gencrypto: [
        { playerId: "alice", gamesPlayed: 3, security: -1, utility: -1 },
        { playerId: "bob", gamesPlayed: 3, security: 1, utility: 1 },
      ],
    });

    const alice = entries.find((e) => e.playerId === "alice")!;
    const bob = entries.find((e) => e.playerId === "bob")!;

    // alice: psi=(1,1), gencrypto=(-1,-1) → avg=(0,0), games=2+3=5
    assert.equal(alice.security, 0);
    assert.equal(alice.utility, 0);
    assert.equal(alice.gamesPlayed, 5);

    // bob: psi=(-1,-1), gencrypto=(1,1) → avg=(0,0), games=2+3=5
    assert.equal(bob.security, 0);
    assert.equal(bob.utility, 0);
    assert.equal(bob.gamesPlayed, 5);
  });

  it("player in only one challenge type — still averages by challenge count", () => {
    const entries = globalAverage.compute({
      psi: [
        { playerId: "alice", gamesPlayed: 2, security: 1, utility: 1 },
        { playerId: "bob", gamesPlayed: 2, security: -1, utility: -1 },
      ],
      gencrypto: [
        { playerId: "charlie", gamesPlayed: 1, security: 0.5, utility: 0.5 },
      ],
    });

    const alice = entries.find((e) => e.playerId === "alice")!;
    // alice only in psi → challengeCount=1 → avg = psi scores
    assert.equal(alice.security, 1);
    assert.equal(alice.utility, 1);
    assert.equal(alice.gamesPlayed, 2);

    const charlie = entries.find((e) => e.playerId === "charlie")!;
    assert.equal(charlie.security, 0.5);
    assert.equal(charlie.utility, 0.5);
    assert.equal(charlie.gamesPlayed, 1);
  });

  it("asymmetric per-challenge scores average correctly", () => {
    const entries = globalAverage.compute({
      psi: [
        { playerId: "alice", gamesPlayed: 4, security: 0.8, utility: 0.2 },
      ],
      gencrypto: [
        { playerId: "alice", gamesPlayed: 2, security: 0.2, utility: 0.8 },
      ],
    });

    const alice = entries.find((e) => e.playerId === "alice")!;
    // avg security = (0.8 + 0.2) / 2 = 0.5
    // avg utility  = (0.2 + 0.8) / 2 = 0.5
    assert.ok(Math.abs(alice.security - 0.5) < 1e-10);
    assert.ok(Math.abs(alice.utility - 0.5) < 1e-10);
    assert.equal(alice.gamesPlayed, 6);
  });
});
