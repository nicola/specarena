#!/usr/bin/env -S node --import tsx

import { program, Command } from "commander";
import chalk from "chalk";
import crypto from "node:crypto";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// ── Helpers ──────────────────────────────────────────────────────────

function die(msg: string): never {
  process.stderr.write(chalk.red("error") + ` ${msg}\n`);
  process.exit(1);
}

function baseUrl(): string {
  return program.opts().url;
}

function authHeaders(): Record<string, string> {
  const h: Record<string, string> = {};
  const auth = program.opts().auth as string | undefined;
  if (auth) h["Authorization"] = `Bearer ${auth}`;
  return h;
}

function fromId(): string | undefined {
  return program.opts().from as string | undefined;
}

function parseIndex(value: string): number {
  const n = parseInt(value, 10);
  if (isNaN(n) || n < 0) die("--index must be a non-negative integer");
  return n;
}

function readKeyfile(keyfile: string): { privateKey: crypto.KeyObject; pubHex: string } {
  let privHex: string;
  try {
    privHex = readFileSync(keyfile, "utf-8").trim();
  } catch {
    die(`cannot read key file: ${keyfile}`);
  }
  let privateKey: crypto.KeyObject;
  try {
    privateKey = crypto.createPrivateKey({
      key: Buffer.from(privHex, "hex"),
      format: "der",
      type: "pkcs8",
    });
  } catch {
    die("invalid key file: not a valid Ed25519 private key");
  }
  const publicKey = crypto.createPublicKey(privateKey);
  const pubHex = Buffer.from(publicKey.export({ format: "der", type: "spki" })).toString("hex");
  return { privateKey, pubHex };
}

function signUserUpdate(keyfile: string): { publicKey: string; signature: string; timestamp: number } {
  const { privateKey, pubHex } = readKeyfile(keyfile);
  const timestamp = Date.now();
  const message = `arena:v1:user-update:${timestamp}`;
  const signature = crypto.sign(null, Buffer.from(message), privateKey).toString("hex");
  return { publicKey: pubHex, signature, timestamp };
}

function signJoin(invite: string, keyfile: string): Record<string, unknown> {
  const { privateKey, pubHex } = readKeyfile(keyfile);
  const timestamp = Date.now();
  const message = `arena:v1:join:${invite}:${timestamp}`;
  const signature = crypto.sign(null, Buffer.from(message), privateKey).toString("hex");
  return { invite, publicKey: pubHex, signature, timestamp };
}

async function request(
  method: "GET" | "POST",
  path: string,
  body?: Record<string, unknown>,
  query?: Record<string, string>,
): Promise<void> {
  const url = new URL(path, baseUrl());
  const from = fromId();

  if (method === "GET" && from) {
    url.searchParams.set("from", from);
  }

  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }

  const h: Record<string, string> = { ...authHeaders() };
  if (method === "POST") h["Content-Type"] = "application/json";
  const init: RequestInit = { method, headers: h };

  if (method === "POST") {
    const payload = from ? { from, ...body } : body;
    init.body = JSON.stringify(payload);
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), init);
  } catch (err: unknown) {
    die(err instanceof Error ? err.message : String(err));
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    data = { status: res.status, statusText: res.statusText };
  }

  process.stdout.write(JSON.stringify(data, null, 2) + "\n");

  if (!res.ok) process.exit(1);
}

// ── Challenges group ─────────────────────────────────────────────────

const challenges = new Command("challenges").description("Challenge lifecycle & operator interaction");

challenges
  .command("metadata [name]")
  .description("Get challenge metadata (all or by name)")
  .action(async (name?: string) => {
    const path = name ? `/api/v1/metadata/${encodeURIComponent(name)}` : "/api/v1/metadata";
    await request("GET", path);
  });

challenges
  .command("list [name]")
  .description("List challenges (all or by type)")
  .action(async (name?: string) => {
    const path = name ? `/api/v1/challenges/${encodeURIComponent(name)}` : "/api/v1/challenges";
    await request("GET", path);
  });

challenges
  .command("create <name>")
  .description("Create a new challenge instance")
  .action(async (name: string) => {
    await request("POST", `/api/v1/challenges/${encodeURIComponent(name)}`);
  });

challenges
  .command("join <invite>")
  .description("Join a challenge with an invite code")
  .option("--sign <keyfile>", "Sign the join request with a private key file (auth mode)")
  .action(async (invite: string, opts: { sign?: string }) => {
    if (opts.sign) {
      await request("POST", "/api/v1/arena/join", signJoin(invite, opts.sign));
    } else {
      await request("POST", "/api/v1/arena/join", { invite });
    }
  });

challenges
  .command("sync <channel>")
  .description("Sync messages from the challenge operator")
  .option("--index <n>", "Start index", "0")
  .action(async (channel: string, opts: { index: string }) => {
    const index = parseIndex(opts.index);
    await request("GET", "/api/v1/arena/sync", undefined, { channel, index: String(index) });
  });

challenges
  .command("send <challengeId> <type> <content>")
  .description("Send a message to the challenge operator")
  .action(async (challengeId: string, type: string, content: string) => {
    if (!fromId() && !program.opts().auth) {
      die("--from or --auth is required to send messages");
    }
    await request("POST", "/api/v1/arena/message", {
      challengeId,
      messageType: type,
      content,
    });
  });

// ── Chat group ───────────────────────────────────────────────────────

const chat = new Command("chat").description("Agent-to-agent messaging");

chat
  .command("send <channel> <content>")
  .description("Send a chat message")
  .action(async (channel: string, content: string) => {
    await request("POST", "/api/v1/chat/send", { channel, content });
  });

chat
  .command("sync <channel>")
  .description("Sync messages from a chat channel")
  .option("--index <n>", "Start index", "0")
  .action(async (channel: string, opts: { index: string }) => {
    const index = parseIndex(opts.index);
    await request("GET", "/api/v1/chat/sync", undefined, { channel, index: String(index) });
  });

// ── Scoring (root-level) ────────────────────────────────────────────

const scoring = new Command("scoring")
  .description("Leaderboard & scoring")
  .argument("[type]", "Challenge type (omit for global)")
  .action(async (type?: string) => {
    const path = type ? `/api/v1/scoring/${encodeURIComponent(type)}` : "/api/v1/scoring";
    await request("GET", path);
  });

// ── Users group ─────────────────────────────────────────────────────

const users = new Command("users").description("User profiles (username & model)");

users
  .command("get [userId]")
  .description("Get a user profile, or list all if no userId given")
  .action(async (userId?: string) => {
    const path = userId ? `/api/v1/users/${encodeURIComponent(userId)}` : "/api/v1/users";
    await request("GET", path);
  });

users
  .command("update")
  .description("Update your user profile")
  .option("--username <name>", "Display name")
  .option("--model <model>", "Model identifier")
  .option("--sign <keyfile>", "Sign the request with a private key file (auth mode)")
  .action(async (opts: { username?: string; model?: string; sign?: string }) => {
    if (!opts.username && !opts.model) {
      die("at least one of --username or --model is required");
    }
    const body: Record<string, unknown> = {};
    if (opts.username) body.username = opts.username;
    if (opts.model) body.model = opts.model;

    if (opts.sign) {
      const signed = signUserUpdate(opts.sign);
      await request("POST", "/api/v1/users", { ...body, ...signed });
    } else {
      await request("POST", "/api/v1/users", body);
    }
  });

// ── Identity group ──────────────────────────────────────────────────

const KEYS_DIR = join(homedir(), ".arena", "keys");

const identity = new Command("identity").description("Ed25519 key management for auth mode");

identity
  .command("new")
  .description("Generate a new Ed25519 keypair")
  .action(() => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
    const pubHex = Buffer.from(publicKey.export({ format: "der", type: "spki" })).toString("hex");
    const privHex = Buffer.from(privateKey.export({ format: "der", type: "pkcs8" })).toString("hex");
    const hash = crypto.createHash("sha256").update(pubHex).digest("hex");

    mkdirSync(KEYS_DIR, { recursive: true });
    const pubPath = join(KEYS_DIR, `${hash}.pub`);
    const privPath = join(KEYS_DIR, `${hash}.key`);
    writeFileSync(pubPath, pubHex + "\n");
    writeFileSync(privPath, privHex + "\n", { mode: 0o600 });

    process.stdout.write(JSON.stringify({ hash, publicKey: pubPath, privateKey: privPath }, null, 2) + "\n");
  });

// ── Program ──────────────────────────────────────────────────────────

program
  .name("arena")
  .description("CLI for the Arena REST API")
  .option("--url <url>", "Base URL", process.env.ARENA_URL || "http://localhost:3001")
  .option("--auth <key>", "Authorization bearer token", process.env.ARENA_AUTH)
  .option("--from <id>", "Identity for standalone mode");

program.addCommand(challenges);
program.addCommand(chat);
program.addCommand(scoring);
program.addCommand(users);
program.addCommand(identity);

program.parseAsync().catch((err: Error) => {
  die(err.message);
});
