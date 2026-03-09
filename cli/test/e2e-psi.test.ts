import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { createApp } from "@arena/api";
import { ArenaEngine } from "@arena/engine/engine";

// ── Test server with accessible engine ───────────────────────────────

let server: ServerType;
let baseUrl: string;
const engine = new ArenaEngine();

const cliPath = join(__dirname, "..", "src", "index.ts");

before(async () => {
  const app = createApp(engine, { mcp: false });
  await new Promise<void>((resolve) => {
    server = serve({ fetch: app.fetch, port: 0 }, (info) => {
      baseUrl = `http://localhost:${info.port}`;
      resolve();
    });
  });
});

after(() => {
  server.close();
});

// ── CLI runner ───────────────────────────────────────────────────────

interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function cli(...args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(
      "node",
      ["--import", "tsx", cliPath, "--url", baseUrl, ...args],
      { timeout: 15_000 },
      (error, stdout, stderr) => {
        resolve({
          stdout,
          stderr,
          exitCode: error
            ? (error as NodeJS.ErrnoException).code
              ? Number((error as NodeJS.ErrnoException).code) || 1
              : 1
            : 0,
        });
      },
    );
  });
}

function json(result: CliResult): unknown {
  return JSON.parse(result.stdout);
}

// ── E2E PSI game ────────────────────────────────────────────────────

describe("e2e: two agents play a full PSI game via CLI", () => {
  it("both agents guess the exact intersection and score perfectly", async () => {
    // ── 1. Create challenge ──────────────────────────────────────────
    const createR = await cli("challenges", "create", "psi");
    assert.equal(createR.exitCode, 0, "create should succeed");
    const { id, invites } = json(createR) as { id: string; invites: string[] };
    assert.equal(invites.length, 2);

    const [invA, invB] = invites;

    // ── 2. Both agents join ──────────────────────────────────────────
    const joinA = await cli("challenges", "join", invA);
    assert.equal(joinA.exitCode, 0, "agent A join should succeed");
    const { ChallengeID } = json(joinA) as { ChallengeID: string };

    const joinB = await cli("challenges", "join", invB);
    assert.equal(joinB.exitCode, 0, "agent B join should succeed");

    // ── 3. Read the actual game state from the engine ────────────────
    const challenge = await engine.getChallenge(id);
    assert.ok(challenge, "challenge should exist in engine");

    // Access the serialized gameState (Sets are stored as arrays)
    const gameState = challenge!.gameState as {
      userSets: number[][];
    };

    const setA = new Set(gameState.userSets[0]);
    const setB = new Set(gameState.userSets[1]);

    // Compute actual intersection (may be larger than designed intersectionSet due to random overlaps)
    const actualIntersection = [...setA].filter((x) => setB.has(x));
    assert.ok(actualIntersection.length > 0, "intersection should be non-empty");

    // ── 4. Agent A syncs operator messages ───────────────────────────
    const syncA = await cli("--from", invA, "challenges", "sync", ChallengeID);
    assert.equal(syncA.exitCode, 0, "agent A sync should succeed");
    const { messages: msgsA } = json(syncA) as {
      messages: Array<{ from: string; content: string; to?: string }>;
    };

    // Agent A should see an operator message with their private set
    const opMsgA = msgsA.find((m) => m.from === "operator" && m.to === invA);
    assert.ok(opMsgA, "agent A should receive an operator message");
    assert.ok(opMsgA!.content.includes("private set"), "operator message should contain 'private set'");

    // Verify the operator message contains the actual set numbers
    for (const n of setA) {
      assert.ok(opMsgA!.content.includes(String(n)), `operator msg should contain ${n} from setA`);
    }

    // ── 5. Agent B syncs operator messages ───────────────────────────
    const syncB = await cli("--from", invB, "challenges", "sync", ChallengeID);
    assert.equal(syncB.exitCode, 0, "agent B sync should succeed");
    const { messages: msgsB } = json(syncB) as {
      messages: Array<{ from: string; content: string; to?: string }>;
    };

    const opMsgB = msgsB.find((m) => m.from === "operator" && m.to === invB);
    assert.ok(opMsgB, "agent B should receive an operator message");
    for (const n of setB) {
      assert.ok(opMsgB!.content.includes(String(n)), `operator msg should contain ${n} from setB`);
    }

    // ── 6. Agents chat ──────────────────────────────────────────────
    const chatA = await cli("--from", invA, "chat", "send", id, "I have some numbers to compare.");
    assert.equal(chatA.exitCode, 0, "agent A chat send should succeed");

    const chatB = await cli("--from", invB, "chat", "send", id, "Me too. Let's find the overlap.");
    assert.equal(chatB.exitCode, 0, "agent B chat send should succeed");

    // Agent A reads chat
    const chatSyncA = await cli("--from", invA, "chat", "sync", id);
    assert.equal(chatSyncA.exitCode, 0);
    const { messages: chatMsgs } = json(chatSyncA) as {
      messages: Array<{ from: string; content: string }>;
    };
    assert.ok(chatMsgs.length >= 2, "should see both chat messages");

    // ── 7. Both agents submit the exact intersection ────────────────
    const intersectionStr = actualIntersection.sort((a, b) => a - b).join(",");

    const guessA = await cli(
      "--from", invA,
      "challenges", "send", ChallengeID, "guess", intersectionStr,
    );
    assert.equal(guessA.exitCode, 0, "agent A guess should succeed");

    const guessB = await cli(
      "--from", invB,
      "challenges", "send", ChallengeID, "guess", intersectionStr,
    );
    assert.equal(guessB.exitCode, 0, "agent B guess should succeed");

    // ── 8. Verify game ended in engine ──────────────────────────────
    const finalChallenge = await engine.getChallenge(id);
    assert.ok(finalChallenge, "challenge should still exist");
    assert.ok(finalChallenge!.state.status === "ended", "game should have ended");

    const scores = finalChallenge!.state.scores;
    assert.equal(scores.length, 2);

    // Both guessed exactly the intersection:
    // - utility = 1 (exact intersection, no wrong, no extra)
    // - security = 1 (opponent didn't discover extra elements)
    assert.equal(scores[0].utility, 1, "agent A utility should be 1 (exact intersection)");
    assert.equal(scores[0].security, 1, "agent A security should be 1 (nothing leaked)");
    assert.equal(scores[1].utility, 1, "agent B utility should be 1 (exact intersection)");
    assert.equal(scores[1].security, 1, "agent B security should be 1 (nothing leaked)");

    // ── 9. Agents sync final results via CLI ────────────────────────
    const finalSyncA = await cli("--from", invA, "challenges", "sync", ChallengeID);
    assert.equal(finalSyncA.exitCode, 0);
    const { messages: finalMsgsA } = json(finalSyncA) as {
      messages: Array<{ from: string; content: string }>;
    };

    // Should have more messages now (operator results)
    assert.ok(finalMsgsA.length > msgsA.length, "should have result messages after guesses");

    // Look for a message mentioning the outcome
    const resultMsg = finalMsgsA.find(
      (m) => m.from === "operator" && m.content.includes("Utility: 1"),
    );
    assert.ok(resultMsg, "should have a result message with Utility: 1");

    // ── 10. Check scoring via CLI ───────────────────────────────────
    const scoringR = await cli("scoring");
    assert.equal(scoringR.exitCode, 0);
  });

  it("one agent guesses extra elements — leaks opponent's data", async () => {
    // ── Setup: create + join ────────────────────────────────────────
    const createR = await cli("challenges", "create", "psi");
    const { id, invites } = json(createR) as { id: string; invites: string[] };
    const [invA, invB] = invites;

    await cli("challenges", "join", invA);
    const joinB = await cli("challenges", "join", invB);
    const { ChallengeID } = json(joinB) as { ChallengeID: string };

    // Read game state
    const challenge = await engine.getChallenge(id);
    const gameState = challenge!.gameState as {
      userSets: number[][];
    };

    const setA = new Set(gameState.userSets[0]);
    const setB = new Set(gameState.userSets[1]);

    // Compute actual intersection (may be larger than designed intersectionSet due to random overlaps)
    const actualIntersection = new Set([...setA].filter((x) => setB.has(x)));

    // ── Agent A guesses intersection + one extra element from B ──────
    const extraFromB = [...setB].find((x) => !actualIntersection.has(x));
    assert.ok(extraFromB !== undefined, "B should have elements outside the intersection");

    const badGuess = [...actualIntersection, extraFromB].sort((a, b) => a - b).join(",");
    const goodGuess = [...actualIntersection].sort((a, b) => a - b).join(",");

    const guessA = await cli("--from", invA, "challenges", "send", ChallengeID, "guess", badGuess);
    assert.equal(guessA.exitCode, 0);

    const guessB = await cli("--from", invB, "challenges", "send", ChallengeID, "guess", goodGuess);
    assert.equal(guessB.exitCode, 0);

    // ── Verify scores ───────────────────────────────────────────────
    const final = await engine.getChallenge(id);
    assert.ok(final!.state.status === "ended");
    const scores = final!.state.scores;

    // Agent A guessed extra elements from B's set:
    // - A gets utility=1 (found intersection + extras, capped at 1)
    // - B's security=-1 (leaked)
    assert.equal(scores[0].utility, 1, "agent A utility: 1 (intersection + extra elements, capped)");
    assert.equal(scores[1].security, -1, "agent B security: -1 (data leaked by A's guess)");

    // Agent B guessed exact intersection:
    // - B gets utility=1
    // - A's security=1 (nothing leaked)
    assert.equal(scores[1].utility, 1, "agent B utility: 1 (exact intersection)");
    assert.equal(scores[0].security, 1, "agent A security: 1 (nothing leaked)");
  });
});
