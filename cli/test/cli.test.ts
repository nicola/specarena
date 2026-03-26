import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { serve } from "@hono/node-server";
import type { ServerType } from "@hono/node-server";
import { createApp } from "@specarena/server";
import { ArenaEngine } from "@specarena/engine/engine";
import { tmpdir } from "node:os";

// ── Test server ──────────────────────────────────────────────────────

let server: ServerType;
let baseUrl: string;
let engine: ArenaEngine;

const cliPath = join(__dirname, "..", "src", "index.ts");

before(async () => {
  engine = new ArenaEngine();
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

beforeEach(async () => {
  await engine.clearRuntimeState();
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
      { timeout: 10_000 },
      (error, stdout, stderr) => {
        resolve({
          stdout,
          stderr,
          exitCode: error ? (error as NodeJS.ErrnoException).code ? Number((error as NodeJS.ErrnoException).code) || 1 : 1 : 0,
        });
      },
    );
  });
}

function cliWithEnv(env: Record<string, string>, ...args: string[]): Promise<CliResult> {
  return new Promise((resolve) => {
    execFile(
      "node",
      ["--import", "tsx", cliPath, "--url", baseUrl, ...args],
      { timeout: 10_000, env: { ...process.env, ...env } },
      (error, stdout, stderr) => {
        resolve({
          stdout,
          stderr,
          exitCode: error ? (error as NodeJS.ErrnoException).code ? Number((error as NodeJS.ErrnoException).code) || 1 : 1 : 0,
        });
      },
    );
  });
}

function json(result: CliResult): unknown {
  return JSON.parse(result.stdout);
}

// ── Tests ────────────────────────────────────────────────────────────

describe("challenges metadata", () => {
  it("returns all metadata", async () => {
    const r = await cli("challenges", "metadata");
    assert.equal(r.exitCode, 0);
    const data = json(r);
    assert.ok(data !== null && typeof data === "object");
  });

  it("returns metadata for a specific challenge", async () => {
    const r = await cli("challenges", "metadata", "psi");
    assert.equal(r.exitCode, 0);
    const data = json(r) as Record<string, unknown>;
    assert.ok(data.name || data.description);
  });

  it("exits 1 for unknown challenge", async () => {
    const r = await cli("challenges", "metadata", "nonexistent");
    assert.equal(r.exitCode, 1);
  });
});

describe("challenges list", () => {
  it("returns empty list", async () => {
    const r = await cli("challenges", "list");
    assert.equal(r.exitCode, 0);
    const data = json(r) as { challenges: unknown[]; total: number };
    assert.deepEqual(data.challenges, []);
    assert.equal(data.total, 0);
  });

  it("returns list by type", async () => {
    const r = await cli("challenges", "list", "psi");
    assert.equal(r.exitCode, 0);
    const data = json(r) as { challenges: unknown[]; total: number };
    assert.equal(data.total, 0);
  });
});

describe("challenges create", () => {
  it("creates a challenge instance", async () => {
    const r = await cli("challenges", "create", "psi");
    assert.equal(r.exitCode, 0);
    const data = json(r) as { id: string; invites: string[] };
    assert.ok(data.id);
    assert.equal(data.invites.length, 2);
  });

  it("exits 1 for unknown challenge type", async () => {
    const r = await cli("challenges", "create", "nonexistent");
    assert.equal(r.exitCode, 1);
  });
});

describe("challenges join", () => {
  it("joins a challenge with an invite", async () => {
    const create = await cli("challenges", "create", "psi");
    const { invites } = json(create) as { invites: string[] };

    const r = await cli("challenges", "join", invites[0]);
    assert.equal(r.exitCode, 0);
    const data = json(r) as { ChallengeID: string };
    assert.ok(data.ChallengeID);
  });

  it("exits 1 for invalid invite", async () => {
    const r = await cli("challenges", "join", "inv_bogus");
    assert.equal(r.exitCode, 1);
  });

  it("exits 1 for --sign with corrupted key file", async () => {
    const badKeyPath = join(tmpdir(), `arena-bad-key-${process.pid}.key`);
    writeFileSync(badKeyPath, "not-valid-hex-garbage\n");
    try {
      const r = await cli("challenges", "join", "inv_bogus", "--sign", badKeyPath);
      assert.equal(r.exitCode, 1);
      assert.ok(r.stderr.includes("invalid key file"), "should print friendly error");
    } finally {
      rmSync(badKeyPath, { force: true });
    }
  });
});

describe("challenges sync", () => {
  it("syncs operator messages after join", async () => {
    const create = await cli("challenges", "create", "psi");
    const { invites } = json(create) as { id: string; invites: string[] };

    // Join as first player
    const joinR = await cli("--from", invites[0], "challenges", "join", invites[0]);
    const { ChallengeID } = json(joinR) as { ChallengeID: string };

    // Sync challenge channel
    const r = await cli("--from", invites[0], "challenges", "sync", ChallengeID);
    assert.equal(r.exitCode, 0);
    const data = json(r) as { messages: unknown[] };
    assert.ok(Array.isArray(data.messages));
  });

  it("respects --index flag", async () => {
    const create = await cli("challenges", "create", "psi");
    const { invites } = json(create) as { invites: string[] };

    const joinR = await cli("--from", invites[0], "challenges", "join", invites[0]);
    const { ChallengeID } = json(joinR) as { ChallengeID: string };

    // Sync with high index → no messages
    const r = await cli("--from", invites[0], "challenges", "sync", ChallengeID, "--index", "999");
    assert.equal(r.exitCode, 0);
    const data = json(r) as { messages: unknown[] };
    assert.deepEqual(data.messages, []);
  });

  it("exits 1 for non-numeric --index", async () => {
    const r = await cli("challenges", "sync", "any-channel", "--index", "abc");
    assert.equal(r.exitCode, 1);
    assert.ok(r.stderr.includes("--index must be a non-negative integer"));
  });
});

describe("challenges send", () => {
  it("sends a message to the operator", async () => {
    const create = await cli("challenges", "create", "psi");
    const { invites } = json(create) as { invites: string[] };

    const j1 = await cli("--from", invites[0], "challenges", "join", invites[0]);
    const { ChallengeID } = json(j1) as { ChallengeID: string };
    await cli("--from", invites[1], "challenges", "join", invites[1]);

    const r = await cli("--from", invites[0], "challenges", "send", ChallengeID, "guess", "1,2,3");
    assert.equal(r.exitCode, 0);
  });

  it("exits 1 without --from", async () => {
    const r = await cli("challenges", "send", "some-id", "guess", "1,2,3");
    assert.equal(r.exitCode, 1);
    assert.ok(r.stderr.includes("--from or --auth is required"));
  });
});

describe("chat send", () => {
  it("sends a chat message", async () => {
    const create = await cli("challenges", "create", "psi");
    const { id, invites } = json(create) as { id: string; invites: string[] };

    await cli("--from", invites[0], "challenges", "join", invites[0]);

    const r = await cli("--from", invites[0], "chat", "send", id, "hello world");
    assert.equal(r.exitCode, 0);
  });

  it("exits 1 without --from", async () => {
    const r = await cli("chat", "send", "some-channel", "hello");
    assert.equal(r.exitCode, 1);
    const data = json(r) as { error: string };
    assert.ok(data.error);
  });
});

describe("chat sync", () => {
  it("syncs chat messages", async () => {
    const create = await cli("challenges", "create", "psi");
    const { id, invites } = json(create) as { id: string; invites: string[] };

    await cli("--from", invites[0], "challenges", "join", invites[0]);
    await cli("--from", invites[0], "chat", "send", id, "hello");

    const r = await cli("--from", invites[0], "chat", "sync", id);
    assert.equal(r.exitCode, 0);
    const data = json(r) as { messages: Array<{ content: string }> };
    assert.ok(data.messages.length >= 1);
    assert.ok(data.messages.some((m) => m.content === "hello"));
  });

  it("respects --index flag", async () => {
    const create = await cli("challenges", "create", "psi");
    const { id, invites } = json(create) as { id: string; invites: string[] };

    await cli("--from", invites[0], "challenges", "join", invites[0]);
    await cli("--from", invites[0], "chat", "send", id, "msg1");

    const r = await cli("--from", invites[0], "chat", "sync", id, "--index", "999");
    assert.equal(r.exitCode, 0);
    const data = json(r) as { messages: unknown[] };
    assert.deepEqual(data.messages, []);
  });
});

describe("scoring", () => {
  it("returns global scoring", async () => {
    const r = await cli("scoring");
    assert.equal(r.exitCode, 0);
    const data = json(r);
    assert.ok(data !== null && typeof data === "object");
  });

  it("returns per-challenge scoring", async () => {
    const r = await cli("scoring", "psi");
    assert.equal(r.exitCode, 0);
  });

  it("exits 1 for unknown challenge type", async () => {
    const r = await cli("scoring", "nonexistent");
    assert.equal(r.exitCode, 1);
  });
});

describe("global flags", () => {
  it("--auth adds Authorization header", async () => {
    // Server doesn't enforce auth, but the request should still succeed
    const r = await cli("--auth", "test-token", "challenges", "metadata");
    assert.equal(r.exitCode, 0);
  });

  it("--from adds identity to requests", async () => {
    const create = await cli("challenges", "create", "psi");
    const { id, invites } = json(create) as { id: string; invites: string[] };
    await cli("--from", invites[0], "challenges", "join", invites[0]);

    // Chat send with --from should work
    const r = await cli("--from", invites[0], "chat", "send", id, "hi");
    assert.equal(r.exitCode, 0);
  });

  it("--url overrides base URL", async () => {
    // Point to a bogus URL — should fail with network error
    const r = await cli("--url", "http://localhost:1", "challenges", "metadata");
    assert.equal(r.exitCode, 1);
    assert.ok(r.stderr.length > 0);
  });
});

describe("identity new", () => {
  const testKeysDir = join(tmpdir(), `arena-test-keys-${process.pid}`);

  before(() => {
    mkdirSync(testKeysDir, { recursive: true });
  });

  after(() => {
    rmSync(testKeysDir, { recursive: true, force: true });
  });

  it("generates a keypair and writes files", async () => {
    // Override HOME so keys go to a temp dir
    const r = await cliWithEnv({ HOME: testKeysDir }, "identity", "new");
    assert.equal(r.exitCode, 0);
    const data = json(r) as { hash: string; publicKey: string; privateKey: string };
    assert.ok(data.hash);
    assert.ok(data.publicKey.endsWith(".pub"));
    assert.ok(data.privateKey.endsWith(".key"));
    assert.ok(existsSync(data.publicKey), "pub file should exist");
    assert.ok(existsSync(data.privateKey), "key file should exist");

    // Key files should contain hex
    const pub = readFileSync(data.publicKey, "utf-8").trim();
    const priv = readFileSync(data.privateKey, "utf-8").trim();
    assert.match(pub, /^[0-9a-f]+$/);
    assert.match(priv, /^[0-9a-f]+$/);
  });

  it("generates unique keys each time", async () => {
    const r1 = await cliWithEnv({ HOME: testKeysDir }, "identity", "new");
    const r2 = await cliWithEnv({ HOME: testKeysDir }, "identity", "new");
    const h1 = (json(r1) as { hash: string }).hash;
    const h2 = (json(r2) as { hash: string }).hash;
    assert.notEqual(h1, h2);
  });
});


describe("full game flow", () => {
  it("create → join → chat → sync → send → results", async () => {
    // 1. Create
    const createR = await cli("challenges", "create", "psi");
    assert.equal(createR.exitCode, 0);
    const { id, invites } = json(createR) as { id: string; invites: string[] };

    // 2. Both players join
    const j1 = await cli("--from", invites[0], "challenges", "join", invites[0]);
    assert.equal(j1.exitCode, 0);
    const { ChallengeID } = json(j1) as { ChallengeID: string };

    const j2 = await cli("--from", invites[1], "challenges", "join", invites[1]);
    assert.equal(j2.exitCode, 0);

    // 3. Sync operator messages (should have private data)
    const sync1 = await cli("--from", invites[0], "challenges", "sync", ChallengeID);
    assert.equal(sync1.exitCode, 0);
    const { messages: opMsgs } = json(sync1) as { messages: Array<{ from: string }> };
    assert.ok(opMsgs.some((m) => m.from === "operator"));

    // 4. Chat between players
    const chatR = await cli("--from", invites[0], "chat", "send", id, "let's trade");
    assert.equal(chatR.exitCode, 0);

    const chatSync = await cli("--from", invites[1], "chat", "sync", id);
    assert.equal(chatSync.exitCode, 0);
    const { messages: chatMsgs } = json(chatSync) as { messages: Array<{ content: string }> };
    assert.ok(chatMsgs.some((m) => m.content === "let's trade"));

    // 5. Both players submit guesses
    const send1 = await cli("--from", invites[0], "challenges", "send", ChallengeID, "guess", "1,2,3");
    assert.equal(send1.exitCode, 0);

    const send2 = await cli("--from", invites[1], "challenges", "send", ChallengeID, "guess", "4,5,6");
    assert.equal(send2.exitCode, 0);

    // 6. Sync again — should have scoring results
    const syncFinal = await cli("--from", invites[0], "challenges", "sync", ChallengeID);
    assert.equal(syncFinal.exitCode, 0);
    const { messages: finalMsgs } = json(syncFinal) as { messages: Array<{ content: string }> };
    assert.ok(finalMsgs.length > opMsgs.length, "should have more messages after guesses");
  });
});
