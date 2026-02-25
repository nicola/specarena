import { describe, it } from "node:test";
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Since config.ts exports top-level constants evaluated at import time,
 * we test env-dependent behavior by spawning subprocesses with different
 * env vars. This ensures each test gets a fresh module evaluation.
 */

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const leaderboardRoot = path.resolve(__dirname, "..", "..");
const tsxPath = path.resolve(leaderboardRoot, "..", "node_modules", ".bin", "tsx");

function evalConfig(env: Record<string, string> = {}): {
  ENGINE_URL: string;
  PUBLIC_ENGINE_URL: string;
} {
  const script = `
    import { ENGINE_URL, PUBLIC_ENGINE_URL } from "./src/lib/config.ts";
    console.log(JSON.stringify({ ENGINE_URL, PUBLIC_ENGINE_URL }));
  `;
  // Build a clean env: start from current process.env, clear the two vars
  // we care about, then apply the test overrides.
  const cleanEnv = { ...process.env };
  delete cleanEnv.ENGINE_URL;
  delete cleanEnv.PUBLIC_ENGINE_URL;
  const result = execFileSync(tsxPath, ["--eval", script], {
    cwd: leaderboardRoot,
    env: { ...cleanEnv, ...env },
    encoding: "utf-8",
  });
  return JSON.parse(result.trim());
}

describe("config", () => {
  it("ENGINE_URL defaults to http://localhost:3001 when env is unset", () => {
    const { ENGINE_URL } = evalConfig();
    assert.strictEqual(ENGINE_URL, "http://localhost:3001");
  });

  it("ENGINE_URL uses ENGINE_URL env var when set", () => {
    const { ENGINE_URL } = evalConfig({ ENGINE_URL: "http://custom:9999" });
    assert.strictEqual(ENGINE_URL, "http://custom:9999");
  });

  it("PUBLIC_ENGINE_URL falls back to ENGINE_URL when not set", () => {
    const { ENGINE_URL, PUBLIC_ENGINE_URL } = evalConfig({
      ENGINE_URL: "http://engine:3001",
    });
    assert.strictEqual(PUBLIC_ENGINE_URL, ENGINE_URL);
    assert.strictEqual(PUBLIC_ENGINE_URL, "http://engine:3001");
  });

  it("PUBLIC_ENGINE_URL falls back to default when neither env var is set", () => {
    const { ENGINE_URL, PUBLIC_ENGINE_URL } = evalConfig();
    assert.strictEqual(PUBLIC_ENGINE_URL, ENGINE_URL);
    assert.strictEqual(PUBLIC_ENGINE_URL, "http://localhost:3001");
  });

  it("PUBLIC_ENGINE_URL uses its own env var when set", () => {
    const { PUBLIC_ENGINE_URL } = evalConfig({
      ENGINE_URL: "http://internal:3001",
      PUBLIC_ENGINE_URL: "https://public.example.com",
    });
    assert.strictEqual(PUBLIC_ENGINE_URL, "https://public.example.com");
  });
});
