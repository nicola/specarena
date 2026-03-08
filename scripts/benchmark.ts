#!/usr/bin/env -S node --import tsx

/**
 * Arena Benchmark Runner
 *
 * Runs benchmark models (via OpenRouter) with tool access against arena challenges.
 * Each model gets a bash tool and a conversation loop, similar to Claude Code.
 *
 * Usage:
 *   OPENROUTER_API_KEY=... node --import tsx scripts/benchmark.ts [options]
 *
 * Options:
 *   --models    Comma-separated OpenRouter model IDs (required)
 *   --game      Challenge type to play (default: psi)
 *   --repeat    Number of games per matchup (default: 1)
 *   --parallel  Run matchups in parallel
 *   --arena-url Arena server URL (default: $ARENA_URL or http://localhost:3001)
 *   --mark      Mark models as benchmark in the arena (default: true)
 *   --max-turns Max conversation turns per agent (default: 30)
 *   --timeout   Max seconds per agent (default: 300)
 */

import { execSync } from "node:child_process";
import crypto from "node:crypto";

// ── Types ────────────────────────────────────────────────────────────

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message: Message;
    finish_reason: string;
  }>;
  error?: { message: string };
}

interface GameResult {
  challengeId: string;
  modelA: string;
  modelB: string;
}

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

interface BashResult {
  stdout: string;
  error: string | null;
}

// ── CLI Parsing ──────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getArg(name: string, defaultValue: string): string {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return defaultValue;
  return args[idx + 1] ?? defaultValue;
}

function hasFlag(name: string): boolean {
  return args.includes(`--${name}`);
}

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
if (!OPENROUTER_API_KEY) {
  console.error("Error: OPENROUTER_API_KEY environment variable is required");
  process.exit(1);
}

const MODELS = (getArg("models", "")).split(",").filter(Boolean);
if (MODELS.length < 2) {
  console.error("Error: --models requires at least 2 comma-separated model IDs");
  console.error("Example: --models anthropic/claude-sonnet-4,openai/gpt-4o,google/gemini-2.0-flash-001");
  process.exit(1);
}

const GAME_TYPE = getArg("game", "psi");
const REPEAT = parseInt(getArg("repeat", "1"), 10);
const PARALLEL = hasFlag("parallel");
const ARENA_URL = getArg("arena-url", process.env.ARENA_URL || "http://localhost:3001").replace(/\/$/, "");
const MARK_BENCHMARK = getArg("mark", "true") !== "false";
const MAX_TURNS = parseInt(getArg("max-turns", "30"), 10);
const TIMEOUT_SECS = parseInt(getArg("timeout", "300"), 10);

// ── Colors ───────────────────────────────────────────────────────────

const c = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const AGENT_COLORS = [c.cyan, c.magenta, c.yellow, c.blue, c.green];
const startTime = Date.now();

function elapsed(): string {
  return `${Math.round((Date.now() - startTime) / 1000)}s`;
}

function log(prefix: string, color: string, msg: string): void {
  console.log(`${c.dim}${elapsed()}${c.reset} ${color}${prefix}${c.reset} ${msg}`);
}

function info(msg: string): void { log("[bench]", c.bold, msg); }
function ok(msg: string): void { log("[bench]", c.green, msg); }
function err(msg: string): void { console.error(`${c.dim}${elapsed()}${c.reset} ${c.red}[bench]${c.reset} ${msg}`); }

// ── HTTP Helpers ─────────────────────────────────────────────────────

async function fetchJSON(url: string, options: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers as Record<string, string>) },
    signal: AbortSignal.timeout(15000),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 200)}`);
  }
}

// ── Key Management ───────────────────────────────────────────────────

function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  return {
    publicKey: publicKey.export({ type: "spki", format: "der" }).toString("hex"),
    privateKey: privateKey.export({ type: "pkcs8", format: "der" }).toString("hex"),
  };
}

function getUserId(publicKeyHex: string): string {
  return crypto.createHash("sha256").update(publicKeyHex).digest("hex");
}

// ── Bash Tool Execution ─────────────────────────────────────────────

function executeBash(command: string, timeoutMs = 30000): BashResult {
  try {
    const result = execSync(command, {
      encoding: "utf-8",
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024,
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { stdout: result.slice(0, 10000), error: null };
  } catch (e: any) {
    const stdout: string = (e.stdout || "").slice(0, 5000);
    const stderr: string = (e.stderr || "").slice(0, 5000);
    return {
      stdout,
      error: `Exit code: ${e.status ?? "unknown"}\n${stderr}`,
    };
  }
}

// ── OpenRouter Tool Use Agent ────────────────────────────────────────

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "bash",
      description: "Execute a bash command and return stdout/stderr. Use this for curl commands to interact with the Arena API, jq for JSON parsing, and any other shell commands needed.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The bash command to execute",
          },
        },
        required: ["command"],
      },
    },
  },
];

async function chatCompletion(model: string, messages: Message[]): Promise<ChatCompletionResponse> {
  const body = {
    model,
    messages,
    tools: TOOLS,
    tool_choice: "auto",
    max_tokens: 4096,
  };

  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenRouter API error ${res.status}: ${text.slice(0, 500)}`);
  }

  return res.json();
}

async function runAgent(model: string, systemPrompt: string, agentLabel: string, agentColor: string): Promise<Message[]> {
  const messages: Message[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: "Please complete the challenge now. Follow all the steps from joining to submitting your answer. Execute each step using the bash tool." },
  ];

  const agentStart = Date.now();
  const deadline = agentStart + TIMEOUT_SECS * 1000;

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (Date.now() > deadline) {
      log(`[${agentLabel}]`, agentColor, `Timeout after ${TIMEOUT_SECS}s`);
      break;
    }

    let response: ChatCompletionResponse;
    try {
      response = await chatCompletion(model, messages);
    } catch (e: any) {
      log(`[${agentLabel}]`, c.red, `API error: ${e.message}`);
      break;
    }

    if (response.error) {
      log(`[${agentLabel}]`, c.red, `API error: ${response.error.message}`);
      break;
    }

    const choice = response.choices?.[0];
    if (!choice) {
      log(`[${agentLabel}]`, c.red, "No response from model");
      break;
    }

    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    // Log text content
    if (assistantMessage.content) {
      const preview = assistantMessage.content.slice(0, 200).replace(/\n/g, " ");
      log(`[${agentLabel}]`, agentColor, `${preview}${assistantMessage.content.length > 200 ? "..." : ""}`);
    }

    // Handle tool calls
    const toolCalls = assistantMessage.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      log(`[${agentLabel}]`, agentColor, "No more tool calls - agent done");
      break;
    }

    for (const toolCall of toolCalls) {
      if (toolCall.function.name !== "bash") {
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: `Unknown tool: ${toolCall.function.name}`,
        });
        continue;
      }

      let parsedArgs: { command: string };
      try {
        parsedArgs = JSON.parse(toolCall.function.arguments);
      } catch {
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: "Error: Could not parse tool arguments as JSON",
        });
        continue;
      }

      const command = parsedArgs.command;
      const cmdPreview = command.slice(0, 120).replace(/\n/g, " ");
      log(`[${agentLabel}]`, agentColor, `$ ${cmdPreview}${command.length > 120 ? "..." : ""}`);

      const result = executeBash(command);
      const output = result.error
        ? `ERROR:\n${result.error}\n\nSTDOUT:\n${result.stdout}`
        : result.stdout;

      // Log abbreviated result
      const resultPreview = output.slice(0, 150).replace(/\n/g, " ");
      log(`[${agentLabel}]`, c.dim, `   -> ${resultPreview}${output.length > 150 ? "..." : ""}`);

      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: output || "(empty output)",
      });
    }

    if (choice.finish_reason === "stop" && !toolCalls?.length) {
      break;
    }
  }

  const duration = Math.round((Date.now() - agentStart) / 1000);
  log(`[${agentLabel}]`, agentColor, `Finished in ${duration}s (${messages.length} messages)`);
  return messages;
}

// ── Game Prompt Builders ─────────────────────────────────────────────

function buildPsiPrompt(arenaUrl: string, challengeId: string, invite: string, pubKey: string, privKey: string): string {
  return `You are playing a Private Set Intersection (PSI) challenge in the Arena.

## Your Details
- Arena URL: ${arenaUrl}
- Challenge ID: ${challengeId}
- Your invite code: ${invite}

## Instructions

Complete these steps using bash/curl commands:

### Step 1: Join the challenge

Join using Ed25519 auth:

\`\`\`bash
PUB_KEY="${pubKey}"
PRIV_KEY="${privKey}"
INVITE="${invite}"
TIMESTAMP=$(date +%s000)

MESSAGE="arena:v1:join:${invite}:\${TIMESTAMP}"
SIGNATURE=$(node -e "
const crypto = require('crypto');
const privKey = crypto.createPrivateKey({
  key: Buffer.from('${privKey}', 'hex'),
  format: 'der',
  type: 'pkcs8'
});
const sig = crypto.sign(null, Buffer.from('\${MESSAGE}'), privKey);
console.log(sig.toString('hex'));
")

curl -sS --max-time 10 -X POST ${arenaUrl}/api/v1/arena/join \\
  -H "Content-Type: application/json" \\
  -d "{\\"invite\\": \\"${invite}\\", \\"publicKey\\": \\"${pubKey}\\", \\"signature\\": \\"\${SIGNATURE}\\", \\"timestamp\\": \${TIMESTAMP}}"
\`\`\`

Save the sessionKey from the response. Use it as "Authorization: Bearer <sessionKey>" on ALL subsequent requests.

### Step 2: Get your private data

Sync the challenge channel for operator messages:
\`GET ${arenaUrl}/api/v1/arena/sync?channel=${challengeId}&index=0\` with Authorization header.

Look for messages from "operator" addressed to you containing your private set.

### Step 3: Chat with your opponent

Send messages: POST to ${arenaUrl}/api/v1/chat/send with {"channel": "${challengeId}", "content": "your message"} and Authorization header.
Read messages: GET ${arenaUrl}/api/v1/chat/sync?channel=${challengeId}&index=0 with Authorization header.

Exchange 3-5 messages to figure out the intersection. Use a tit-for-tat strategy: reveal items one at a time in exchange for your opponent doing the same.

### Step 4: Submit your guess

POST to ${arenaUrl}/api/v1/arena/message with {"challengeId": "${challengeId}", "messageType": "guess", "content": "item1,item2,..."} and Authorization header.

### Step 5: Check results

Sync again to get your scores from the operator.

## Important Rules
- Always use -sS --max-time 10 with curl
- Parse JSON with jq
- Complete ALL steps`;
}

function buildUltimatumPrompt(arenaUrl: string, challengeId: string, invite: string, pubKey: string, privKey: string): string {
  return `You are playing an Ultimatum Game challenge in the Arena.

## Your Details
- Arena URL: ${arenaUrl}
- Challenge ID: ${challengeId}
- Your invite code: ${invite}

## Instructions

Complete these steps using bash/curl commands:

### Step 1: Join the challenge

Join using Ed25519 auth:

\`\`\`bash
TIMESTAMP=$(date +%s000)
MESSAGE="arena:v1:join:${invite}:\${TIMESTAMP}"
SIGNATURE=$(node -e "
const crypto = require('crypto');
const privKey = crypto.createPrivateKey({
  key: Buffer.from('${privKey}', 'hex'),
  format: 'der',
  type: 'pkcs8'
});
const sig = crypto.sign(null, Buffer.from('\${MESSAGE}'), privKey);
console.log(sig.toString('hex'));
")

curl -sS --max-time 10 -X POST ${arenaUrl}/api/v1/arena/join \\
  -H "Content-Type: application/json" \\
  -d "{\\"invite\\": \\"${invite}\\", \\"publicKey\\": \\"${pubKey}\\", \\"signature\\": \\"\${SIGNATURE}\\", \\"timestamp\\": \${TIMESTAMP}}"
\`\`\`

Save the sessionKey. Use "Authorization: Bearer <sessionKey>" on ALL subsequent requests.

### Step 2: Get your private reservation value

Sync: GET ${arenaUrl}/api/v1/arena/sync?channel=${challengeId}&index=0 with Authorization header.
Look for operator messages with your reservation value.

### Step 3: Negotiate with opponent

Chat via POST ${arenaUrl}/api/v1/chat/send and GET ${arenaUrl}/api/v1/chat/sync.

### Step 4: Take game actions

POST to ${arenaUrl}/api/v1/arena/message with {"challengeId": "${challengeId}", "messageType": "<action>", "content": "<details>"} and Authorization header.

Actions: submit_offer (e.g. content "60 40"), accept, reject, pass.
Sync the challenge channel between actions.

### Step 5: Check results

Sync again after the game ends.

## Strategy
- Try to maximize your utility while respecting your reservation value
- Be willing to negotiate but don't accept below your reservation

## Rules
- Always use -sS --max-time 10 with curl
- Parse JSON with jq
- Complete ALL steps`;
}

function buildPrompt(gameType: string, arenaUrl: string, challengeId: string, invite: string, pubKey: string, privKey: string): string {
  switch (gameType) {
    case "ultimatum":
      return buildUltimatumPrompt(arenaUrl, challengeId, invite, pubKey, privKey);
    case "psi":
    default:
      return buildPsiPrompt(arenaUrl, challengeId, invite, pubKey, privKey);
  }
}

// ── Game Runner ──────────────────────────────────────────────────────

async function runGame(modelA: string, modelB: string, gameNum: number): Promise<GameResult | null> {
  const colorA = AGENT_COLORS[0];
  const colorB = AGENT_COLORS[1];
  const labelA = modelA.split("/").pop()!;
  const labelB = modelB.split("/").pop()!;

  info(`Game ${gameNum}: ${labelA} vs ${labelB} (${GAME_TYPE})`);

  // Generate keys
  const keysA = generateKeyPair();
  const keysB = generateKeyPair();
  const userIdA = getUserId(keysA.publicKey);
  const userIdB = getUserId(keysB.publicKey);

  // Update user profiles & mark as benchmark
  if (MARK_BENCHMARK) {
    await fetchJSON(`${ARENA_URL}/api/v1/users`, {
      method: "POST",
      body: JSON.stringify({ userId: userIdA, username: labelA, model: modelA, isBenchmark: true }),
    });
    await fetchJSON(`${ARENA_URL}/api/v1/users`, {
      method: "POST",
      body: JSON.stringify({ userId: userIdB, username: labelB, model: modelB, isBenchmark: true }),
    });
    ok(`Marked ${labelA} and ${labelB} as benchmark models`);
  }

  // Create challenge
  const challenge = await fetchJSON(`${ARENA_URL}/api/v1/challenges/${GAME_TYPE}`, {
    method: "POST",
  });

  if (!challenge.id) {
    err(`Failed to create challenge: ${JSON.stringify(challenge)}`);
    return null;
  }

  const challengeId: string = challenge.id;
  const inviteA: string = challenge.invites[0];
  const inviteB: string = challenge.invites[1];

  ok(`Challenge created: ${challengeId}`);

  // Build prompts
  const promptA = buildPrompt(GAME_TYPE, ARENA_URL, challengeId, inviteA, keysA.publicKey, keysA.privateKey);
  const promptB = buildPrompt(GAME_TYPE, ARENA_URL, challengeId, inviteB, keysB.publicKey, keysB.privateKey);

  // Run both agents concurrently
  await Promise.all([
    runAgent(modelA, promptA, labelA, colorA),
    runAgent(modelB, promptB, labelB, colorB),
  ]);

  // Fetch final state
  let finalSync: any;
  try {
    finalSync = await fetchJSON(
      `${ARENA_URL}/api/v1/arena/sync?channel=${challengeId}&from=viewer&index=0`
    );
  } catch {
    finalSync = null;
  }

  console.log("");
  console.log(`${c.bold}${"=".repeat(60)}${c.reset}`);
  console.log(`${c.bold}  Game ${gameNum} Results: ${labelA} vs ${labelB}${c.reset}`);
  console.log(`${c.bold}${"=".repeat(60)}${c.reset}`);

  if (finalSync?.messages) {
    const scores = finalSync.messages.filter(
      (m: any) => m.from === "operator" && /score|utility|security/i.test(m.content)
    );
    if (scores.length > 0) {
      for (const s of scores) {
        const target = s.to ? s.to.slice(0, 12) + "..." : "broadcast";
        console.log(`${c.green}  -> ${target}: ${s.content}${c.reset}`);
      }
    } else {
      console.log(`${c.yellow}  No score messages found${c.reset}`);
    }
  }

  console.log(`${c.bold}${"=".repeat(60)}${c.reset}`);
  console.log("");

  return { challengeId, modelA, modelB };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  info("Arena Benchmark Runner");
  info(`Models: ${MODELS.join(", ")}`);
  info(`Game: ${GAME_TYPE}, Repeat: ${REPEAT}, Arena: ${ARENA_URL}`);

  // Preflight check
  try {
    await fetchJSON(`${ARENA_URL}/api/v1/metadata`);
    ok("Arena is reachable");
  } catch (e: any) {
    err(`Cannot reach arena at ${ARENA_URL}: ${e.message}`);
    process.exit(1);
  }

  // Generate all matchups (round-robin)
  const matchups: [string, string][] = [];
  for (let i = 0; i < MODELS.length; i++) {
    for (let j = i + 1; j < MODELS.length; j++) {
      for (let r = 0; r < REPEAT; r++) {
        matchups.push([MODELS[i], MODELS[j]]);
      }
    }
  }

  info(`Total matchups: ${matchups.length}`);

  const results: GameResult[] = [];

  if (PARALLEL) {
    const tasks = matchups.map(([a, b], idx) => runGame(a, b, idx + 1));
    const settled = await Promise.allSettled(tasks);
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
  } else {
    for (let i = 0; i < matchups.length; i++) {
      const [a, b] = matchups[i];
      try {
        const result = await runGame(a, b, i + 1);
        if (result) results.push(result);
      } catch (e: any) {
        err(`Game ${i + 1} failed: ${e.message}`);
      }
    }
  }

  console.log("");
  ok(`Benchmark complete: ${results.length}/${matchups.length} games finished`);
  info(`Total time: ${elapsed()}`);
}

main().catch((e: any) => {
  err(e.message);
  process.exit(1);
});
