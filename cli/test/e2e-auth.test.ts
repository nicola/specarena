import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { createAuthApp } from "@arena/auth/server";

// ── Auth server with known secret ───────────────────────────────────

let server: ServerType;
let baseUrl: string;
let engine: ReturnType<typeof createAuthApp>["engine"];

const cliPath = join(__dirname, "..", "src", "index.ts");
const testKeysDir = join(tmpdir(), `arena-e2e-auth-${process.pid}`);

before(async () => {
  mkdirSync(testKeysDir, { recursive: true });
  const authApp = createAuthApp({ secret: "test-secret" });
  engine = authApp.engine;
  await new Promise<void>((resolve) => {
    server = serve({ fetch: authApp.app.fetch, port: 0 }, (info) => {
      baseUrl = `http://localhost:${info.port}`;
      resolve();
    });
  });
});

after(() => {
  server.close();
  rmSync(testKeysDir, { recursive: true, force: true });
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
      { timeout: 15_000, env: { ...process.env, HOME: testKeysDir } },
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

// ── Tests ───────────────────────────────────────────────────────────

describe("e2e: full PSI game via CLI with auth", () => {
  it("two agents generate keys, join with --sign, play with --auth", async () => {
    // ── 1. Each agent generates a keypair ────────────────────────────
    const keyA = await cli("identity", "new");
    assert.equal(keyA.exitCode, 0, "agent A keygen should succeed");
    const { privateKey: keyfileA } = json(keyA) as { hash: string; privateKey: string };

    const keyB = await cli("identity", "new");
    assert.equal(keyB.exitCode, 0, "agent B keygen should succeed");
    const { privateKey: keyfileB } = json(keyB) as { hash: string; privateKey: string };

    // ── 2. Create a challenge ────────────────────────────────────────
    const createR = await cli("challenges", "create", "psi");
    assert.equal(createR.exitCode, 0, "create should succeed");
    const { id, invites } = json(createR) as { id: string; invites: string[] };
    const [invA, invB] = invites;

    // ── 3. Join without --sign should fail (auth server requires sig) ─
    const joinNoSign = await cli("challenges", "join", invA);
    assert.equal(joinNoSign.exitCode, 1, "join without signature should fail on auth server");

    // ── 4. Agent A joins with --sign ─────────────────────────────────
    const joinA = await cli("challenges", "join", invA, "--sign", keyfileA);
    assert.equal(joinA.exitCode, 0, `agent A join should succeed: ${joinA.stdout} ${joinA.stderr}`);
    const joinDataA = json(joinA) as { ChallengeID: string; sessionKey: string };
    assert.ok(joinDataA.ChallengeID, "should have ChallengeID");
    assert.ok(joinDataA.sessionKey, "should have sessionKey");
    assert.ok(joinDataA.sessionKey.startsWith("s_"), "sessionKey should start with s_");

    // ── 5. Agent B joins with --sign ─────────────────────────────────
    const joinB = await cli("challenges", "join", invB, "--sign", keyfileB);
    assert.equal(joinB.exitCode, 0, "agent B join should succeed");
    const joinDataB = json(joinB) as { ChallengeID: string; sessionKey: string };
    assert.ok(joinDataB.sessionKey, "agent B should have sessionKey");

    // ── 6. Read game state from engine to get the intersection ──────
    const challenge = await engine.getChallenge(id);
    assert.ok(challenge, "challenge should exist");
    const gameState = (challenge.instance as any).gameState as {
      userSets: Set<number>[];
    };
    // Compute the actual intersection (may be larger than the designed one due to random overlaps)
    const actualIntersection = [...gameState.userSets[0]].filter((x) => gameState.userSets[1].has(x));
    const intersection = actualIntersection.sort((a, b) => a - b).join(",");

    // ── 7. Agent A syncs operator messages using --auth ──────────────
    const syncA = await cli("--auth", joinDataA.sessionKey, "challenges", "sync", joinDataA.ChallengeID);
    assert.equal(syncA.exitCode, 0, "agent A sync should succeed with session key");
    const { messages: msgsA } = json(syncA) as {
      messages: Array<{ from: string; content: string; to?: string }>;
    };
    const opMsgA = msgsA.find((m) => m.from === "operator" && m.to === invA);
    assert.ok(opMsgA, "agent A should receive operator message with private set");
    assert.ok(opMsgA!.content.includes("private set"), "operator msg should mention private set");

    // ── 8. Agent B syncs with --auth ─────────────────────────────────
    const syncB = await cli("--auth", joinDataB.sessionKey, "challenges", "sync", joinDataB.ChallengeID);
    assert.equal(syncB.exitCode, 0, "agent B sync should succeed");
    const { messages: msgsB } = json(syncB) as {
      messages: Array<{ from: string; content: string; to?: string }>;
    };
    const opMsgB = msgsB.find((m) => m.from === "operator" && m.to === invB);
    assert.ok(opMsgB, "agent B should receive operator message");

    // ── 9. Agents chat using --auth ──────────────────────────────────
    const chatA = await cli("--auth", joinDataA.sessionKey, "chat", "send", id, "What numbers do you have?");
    assert.equal(chatA.exitCode, 0, "agent A chat should succeed");

    const chatB = await cli("--auth", joinDataB.sessionKey, "chat", "send", id, "Let's find the overlap.");
    assert.equal(chatB.exitCode, 0, "agent B chat should succeed");

    // Agent A reads chat
    const chatSyncA = await cli("--auth", joinDataA.sessionKey, "chat", "sync", id);
    assert.equal(chatSyncA.exitCode, 0);
    const { messages: chatMsgs } = json(chatSyncA) as {
      messages: Array<{ content: string }>;
    };
    assert.ok(chatMsgs.length >= 2, "should see both chat messages");

    // ── 10. Both agents submit the exact intersection via --auth ─────
    const guessA = await cli(
      "--auth", joinDataA.sessionKey,
      "challenges", "send", joinDataA.ChallengeID, "guess", intersection,
    );
    assert.equal(guessA.exitCode, 0, "agent A guess should succeed");

    const guessB = await cli(
      "--auth", joinDataB.sessionKey,
      "challenges", "send", joinDataB.ChallengeID, "guess", intersection,
    );
    assert.equal(guessB.exitCode, 0, "agent B guess should succeed");

    // ── 11. Verify scores ────────────────────────────────────────────
    const final = await engine.getChallenge(id);
    assert.ok(final!.instance.state.gameEnded, "game should have ended");
    const scores = final!.instance.state.scores;
    assert.equal(scores[0].utility, 1, "agent A utility: 1 (exact intersection)");
    assert.equal(scores[0].security, 1, "agent A security: 1");
    assert.equal(scores[1].utility, 1, "agent B utility: 1 (exact intersection)");
    assert.equal(scores[1].security, 1, "agent B security: 1");

    // ── 12. Verify playerIdentities are set (auth derives userId) ────
    const identities = final!.instance.state.playerIdentities;
    assert.ok(identities[invA], "agent A should have a userId from public key");
    assert.ok(identities[invB], "agent B should have a userId from public key");
    assert.notEqual(identities[invA], identities[invB], "different keys → different userIds");

    // ── 13. Final sync shows results ─────────────────────────────────
    const finalSync = await cli("--auth", joinDataA.sessionKey, "challenges", "sync", joinDataA.ChallengeID);
    assert.equal(finalSync.exitCode, 0);
    const { messages: finalMsgs } = json(finalSync) as {
      messages: Array<{ from: string; content: string }>;
    };
    assert.ok(finalMsgs.length > msgsA.length, "should have more messages after game end");

    // ── 14. Scoring endpoint works ───────────────────────────────────
    const scoringR = await cli("scoring");
    assert.equal(scoringR.exitCode, 0);
  });

  it("wrong session key is rejected", async () => {
    const createR = await cli("challenges", "create", "psi");
    const { invites } = json(createR) as { invites: string[] };

    const keyR = await cli("identity", "new");
    const { privateKey: keyfile } = json(keyR) as { privateKey: string };

    const joinR = await cli("challenges", "join", invites[0], "--sign", keyfile);
    const { ChallengeID } = json(joinR) as { ChallengeID: string };

    // Use a bogus session key
    const syncR = await cli("--auth", "s_0.aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa", "challenges", "sync", ChallengeID);
    assert.equal(syncR.exitCode, 1, "bogus session key should be rejected");
    const data = json(syncR) as { error: string };
    assert.ok(data.error, "should have error message");
  });

  it("viewer (no auth) gets redacted data", async () => {
    const createR = await cli("challenges", "create", "psi");
    const { id, invites } = json(createR) as { id: string; invites: string[] };

    const keyR = await cli("identity", "new");
    const { privateKey: keyfile } = json(keyR) as { privateKey: string };

    // Join player A
    await cli("challenges", "join", invites[0], "--sign", keyfile);

    // Sync as viewer (no --auth, no --from) — should succeed but with redacted DMs
    const syncR = await cli("challenges", "sync", `challenge_${id}`);
    assert.equal(syncR.exitCode, 0, "viewer sync should succeed");
    const { messages } = json(syncR) as {
      messages: Array<{ from: string; to?: string; content: string; redacted?: boolean }>;
    };

    // DMs to the player should be redacted for the viewer
    const dmToPlayer = messages.find((m) => m.to && m.to !== "viewer");
    if (dmToPlayer) {
      assert.ok(dmToPlayer.redacted, "DMs should be redacted for viewer");
    }
  });
});
