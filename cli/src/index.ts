#!/usr/bin/env -S node --import tsx

import { program, Command } from "commander";
import chalk from "chalk";

// ── Helpers ──────────────────────────────────────────────────────────

function baseUrl(): string {
  return program.opts().url;
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const auth = program.opts().auth as string | undefined;
  if (auth) h["Authorization"] = `Bearer ${auth}`;
  return h;
}

function fromId(): string | undefined {
  return program.opts().from as string | undefined;
}

async function request(method: "GET" | "POST", path: string, body?: Record<string, unknown>): Promise<void> {
  const url = new URL(path, baseUrl());
  const from = fromId();

  if (method === "GET" && from) {
    url.searchParams.set("from", from);
  }

  const init: RequestInit = { method, headers: headers() };

  if (method === "POST") {
    const payload = from ? { from, ...body } : body;
    init.body = JSON.stringify(payload);
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), init);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(chalk.red("error") + ` ${msg}\n`);
    process.exit(1);
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
    const path = name ? `/api/v1/metadata/${name}` : "/api/v1/metadata";
    await request("GET", path);
  });

challenges
  .command("list [name]")
  .description("List challenges (all or by type)")
  .action(async (name?: string) => {
    const path = name ? `/api/v1/challenges/${name}` : "/api/v1/challenges";
    await request("GET", path);
  });

challenges
  .command("create <name>")
  .description("Create a new challenge instance")
  .action(async (name: string) => {
    await request("POST", `/api/v1/challenges/${name}`);
  });

challenges
  .command("join <invite>")
  .description("Join a challenge with an invite code")
  .action(async (invite: string) => {
    await request("POST", "/api/v1/arena/join", { invite });
  });

challenges
  .command("sync <channel>")
  .description("Sync messages from the challenge operator")
  .option("--index <n>", "Start index", "0")
  .action(async (channel: string, opts: { index: string }) => {
    const url = new URL("/api/v1/arena/sync", baseUrl());
    url.searchParams.set("channel", channel);
    url.searchParams.set("index", opts.index);
    const from = fromId();
    if (from) url.searchParams.set("from", from);

    let res: Response;
    try {
      res = await fetch(url.toString(), { method: "GET", headers: headers() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(chalk.red("error") + ` ${msg}\n`);
      process.exit(1);
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = { status: res.status, statusText: res.statusText };
    }

    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    if (!res.ok) process.exit(1);
  });

challenges
  .command("send <challengeId> <type> <content>")
  .description("Send a message to the challenge operator")
  .action(async (challengeId: string, type: string, content: string) => {
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
    const url = new URL("/api/v1/chat/sync", baseUrl());
    url.searchParams.set("channel", channel);
    url.searchParams.set("index", opts.index);
    const from = fromId();
    if (from) url.searchParams.set("from", from);

    let res: Response;
    try {
      res = await fetch(url.toString(), { method: "GET", headers: headers() });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      process.stderr.write(chalk.red("error") + ` ${msg}\n`);
      process.exit(1);
    }

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      data = { status: res.status, statusText: res.statusText };
    }

    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
    if (!res.ok) process.exit(1);
  });

// ── Scoring (root-level) ────────────────────────────────────────────

const scoring = new Command("scoring")
  .description("Leaderboard & scoring")
  .argument("[type]", "Challenge type (omit for global)")
  .action(async (type?: string) => {
    const path = type ? `/api/v1/scoring/${type}` : "/api/v1/scoring";
    await request("GET", path);
  });

// ── Program ──────────────────────────────────────────────────────────

program
  .name("arena")
  .description("CLI for the Arena REST API")
  .option("--url <url>", "Base URL", process.env.ARENA_URL || "http://localhost:3001")
  .option("--auth <key>", "Authorization bearer token")
  .option("--from <id>", "Identity for standalone mode");

program.addCommand(challenges);
program.addCommand(chat);
program.addCommand(scoring);

program.parseAsync();
