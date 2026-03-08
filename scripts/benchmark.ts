#!/usr/bin/env -S node --import tsx

/**
 * Arena Benchmark Runner
 *
 * Runs benchmark models (via OpenRouter) with tool access against arena challenges.
 * Each model gets a bash tool and a conversation loop, similar to Claude Code.
 * Challenge instructions are loaded dynamically from /api/metadata and SKILL.md.
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
 *   --max-turns Max conversation turns per agent (default: 30)
 *   --timeout   Max seconds per agent (default: 300)
 *
 * Note: Models must be marked as benchmark in the database by an admin.
 */

import { config } from "dotenv";
config(); // load .env from project root

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import crypto from "node:crypto";

const execFileAsync = promisify(execFile);

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

interface BenchmarkGameResult {
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

interface ChallengeMetadata {
  name: string;
  description: string;
  players: number;
  prompt: string;
  methods: { name: string; description: string }[];
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
const ARENA_URL = getArg("arena-url", process.env.ARENA_URL || "http://localhost:3011").replace(/\/$/, "");
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

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${url}`);
  return res.text();
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

import { writeFileSync, readFileSync, existsSync, unlinkSync, mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEYS_FILE = join(__dirname, ".benchmark-keys.json");

type StoredKeys = Record<string, KeyPair>; // model ID -> key pair

function loadStoredKeys(): StoredKeys {
  if (!existsSync(KEYS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(KEYS_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveStoredKeys(keys: StoredKeys): void {
  writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2) + "\n");
}

function getOrCreateKeyPair(modelId: string): KeyPair {
  const stored = loadStoredKeys();
  if (stored[modelId]) return stored[modelId];
  const keys = generateKeyPair();
  stored[modelId] = keys;
  saveStoredKeys(stored);
  return keys;
}

/**
 * Creates a persistent bash execution context for an agent.
 * Environment variables set via `export` persist across calls by
 * writing them to a temp env file that is sourced before each command.
 */
function createBashContext(): { execute: (command: string, timeoutMs?: number) => Promise<BashResult>; cleanup: () => void } {
  const envDir = mkdtempSync(join(tmpdir(), "arena-bench-"));
  const envFile = join(envDir, "env.sh");
  writeFileSync(envFile, "# agent env\n");

  async function execute(command: string, timeoutMs = 30000): Promise<BashResult> {
    // Wrap the command: source env file, run command, then capture any new exports
    const wrappedCommand = `
source "${envFile}" 2>/dev/null
${command}
_exit_code=$?
# Capture exported vars back to env file
export -p | grep -v '_exit_code' > "${envFile}.new" 2>/dev/null && mv "${envFile}.new" "${envFile}"
exit $_exit_code
`;
    try {
      const { stdout } = await execFileAsync("/bin/bash", ["-c", wrappedCommand], {
        encoding: "utf-8",
        timeout: timeoutMs,
        maxBuffer: 1024 * 1024,
      });
      return { stdout: stdout.slice(0, 10000), error: null };
    } catch (e: any) {
      const stdout: string = (e.stdout || "").slice(0, 5000);
      const stderr: string = (e.stderr || "").slice(0, 5000);
      return {
        stdout,
        error: `Exit code: ${e.status ?? "unknown"}\n${stderr}`,
      };
    }
  }

  function cleanup(): void {
    try { unlinkSync(envFile); } catch {}
    try { unlinkSync(envFile + ".new"); } catch {}
    try { unlinkSync(envDir); } catch {}
  }

  return { execute, cleanup };
}

// ── OpenRouter Tool Use Agent ────────────────────────────────────────

const TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "bash",
      description: "Execute a bash command and return stdout/stderr. Environment variables set via `export` persist across calls. Use this for curl commands to interact with the Arena API, jq for JSON parsing, and any other shell commands needed.",
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
  const bash = createBashContext();
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
      // Check if the agent has actually finished (submitted answer + got scores)
      const transcript = messages.map((m) => m.content || "").join(" ");
      const hasSubmitted = /arena\/message|messageType/.test(transcript) && /score|utility|security/i.test(transcript);
      if (hasSubmitted) {
        log(`[${agentLabel}]`, agentColor, "Agent done (scores received)");
        break;
      }
      // Nudge the model to keep going
      log(`[${agentLabel}]`, agentColor, "No tool calls — nudging to continue...");
      messages.push({
        role: "user",
        content: "You haven't finished yet. Continue executing the next step using the bash tool. Remember: join → sync for private data → chat with opponent (multiple rounds, poll for replies) → submit answer → check scores.",
      });
      continue;
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

      const result = await bash.execute(command);
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

  bash.cleanup();
  const duration = Math.round((Date.now() - agentStart) / 1000);
  log(`[${agentLabel}]`, agentColor, `Finished in ${duration}s (${messages.length} messages)`);
  return messages;
}

// ── Prompt Builder ───────────────────────────────────────────────────

function buildAgentPrompt(
  arenaUrl: string,
  challengeId: string,
  invite: string,
  pubKey: string,
  privKey: string,
  metadata: ChallengeMetadata,
  skillContent: string,
): string {
  const methodsSection = metadata.methods
    .map((m) => `- **${m.name}**: ${m.description}`)
    .join("\n");

  return `You are playing the "${metadata.name}" challenge in the Arena.

## Challenge Description
${metadata.description}

## Challenge Prompt
${metadata.prompt}

## Available Actions
${methodsSection}

## Your Details
- Arena URL: ${arenaUrl}
- Challenge ID: ${challengeId}
- Your invite code: ${invite}

## Auth Keys (Ed25519)
- Public key (SPKI DER hex): ${pubKey}
- Private key (PKCS8 DER hex): ${privKey}

## How to Join

Sign and join using these keys:

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

Save the sessionKey from the response. Use it as "Authorization: Bearer <sessionKey>" on ALL subsequent requests. Do NOT send "from" — the server resolves your identity from the session key.

## Arena Skill Reference

${skillContent}

## Step-by-Step Flow

1. **Join** the challenge using the auth code above. Save the sessionKey.
2. **Sync the arena channel** to get your private data from the operator:
   \`curl -sS --max-time 10 "${arenaUrl}/api/v1/arena/sync?channel=${challengeId}&index=0" -H "Authorization: Bearer \$SESSION_KEY"\`
3. **Chat with your opponent** — send messages and read theirs. Do multiple rounds (3-5 exchanges):
   - Send: \`curl -sS --max-time 10 -X POST ${arenaUrl}/api/v1/chat/send -H "Content-Type: application/json" -H "Authorization: Bearer \$SESSION_KEY" -d '{"channel":"${challengeId}","content":"your message"}'\`
   - Read: \`curl -sS --max-time 10 "${arenaUrl}/api/v1/chat/sync?channel=${challengeId}&index=0" -H "Authorization: Bearer \$SESSION_KEY"\`
   - **IMPORTANT**: After sending a message, poll for your opponent's reply by calling chat/sync repeatedly (with a 5 second sleep between attempts). Wait until you see a new message from your opponent before continuing. Do NOT rush — your opponent may take up to 60 seconds to respond.
4. **Submit your answer** when ready using the arena/message endpoint.
5. **Check results** by syncing the arena channel again for score messages.

## Important Rules
- ALWAYS use ${arenaUrl} as the base URL for ALL API requests. Do NOT use any other URL or port.
- Always use -sS --max-time 10 with curl
- Parse JSON with jq
- Be PATIENT: your opponent may take 30-60 seconds to respond. ALWAYS use the polling loop after sending a chat message. Do NOT submit your final answer until you have exchanged at least 3 rounds of chat messages with your opponent.
- Complete ALL steps from joining to checking results`;
}

// ── Model Name Formatting ────────────────────────────────────────────

/**
 * Convert an OpenRouter model ID to a well-formatted display name.
 * e.g. "anthropic/claude-sonnet-4" -> "Claude Sonnet 4"
 *      "openai/gpt-4o"            -> "GPT 4o"
 *      "google/gemini-2.0-flash-001" -> "Gemini 2.0 Flash 001"
 */
function formatModelName(modelId: string): string {
  const slug = modelId.split("/").pop()!;
  return slug
    .split("-")
    .map((part) => {
      // Keep version-like tokens as-is (e.g. "2.0", "4o", "001")
      if (/^\d/.test(part)) return part;
      // Uppercase known abbreviations
      if (/^gpt$/i.test(part)) return "GPT";
      if (/^llama$/i.test(part)) return "LLaMA";
      // Capitalize first letter
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

/**
 * Sign a user-update message with an Ed25519 private key.
 */
function signMessage(message: string, privateKeyHex: string): string {
  const privKey = crypto.createPrivateKey({
    key: Buffer.from(privateKeyHex, "hex"),
    format: "der",
    type: "pkcs8",
  });
  return crypto.sign(null, Buffer.from(message), privKey).toString("hex");
}

/**
 * Register user profiles for all models before games begin.
 * Uses signed auth so it works with both auth and non-auth servers.
 */
async function registerModels(models: string[]): Promise<Map<string, { keys: KeyPair; userId: string }>> {
  const agents = new Map<string, { keys: KeyPair; userId: string }>();

  for (const model of models) {
    const keys = getOrCreateKeyPair(model);
    const userId = getUserId(keys.publicKey);
    const username = formatModelName(model);
    const timestamp = Date.now();
    const message = `arena:v1:user-update:${timestamp}`;
    const signature = signMessage(message, keys.privateKey);

    const regResult = await fetchJSON(`${ARENA_URL}/api/users`, {
      method: "POST",
      body: JSON.stringify({
        publicKey: keys.publicKey,
        signature,
        timestamp,
        username,
        model,
      }),
    });

    if (regResult.error) {
      err(`Failed to register ${username}: ${regResult.error}`);
    }

    agents.set(model, { keys, userId });
    ok(`Registered ${username} (${model}) -> userId: ${userId.slice(0, 16)}...`);
  }

  return agents;
}

// ── Game Runner ──────────────────────────────────────────────────────

async function runGame(
  modelA: string,
  modelB: string,
  gameNum: number,
  metadata: ChallengeMetadata,
  skillContent: string,
  agents: Map<string, { keys: KeyPair; userId: string }>,
): Promise<BenchmarkGameResult | null> {
  const colorA = AGENT_COLORS[0];
  const colorB = AGENT_COLORS[1];
  const labelA = formatModelName(modelA);
  const labelB = formatModelName(modelB);

  info(`Game ${gameNum}: ${labelA} vs ${labelB} (${GAME_TYPE})`);

  // Use pre-registered keys
  const keysA = agents.get(modelA)!.keys;
  const keysB = agents.get(modelB)!.keys;

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

  // Build prompts from metadata + skill
  const promptA = buildAgentPrompt(ARENA_URL, challengeId, inviteA, keysA.publicKey, keysA.privateKey, metadata, skillContent);
  const promptB = buildAgentPrompt(ARENA_URL, challengeId, inviteB, keysB.publicKey, keysB.privateKey, metadata, skillContent);

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

  // Fetch challenge metadata
  const allMetadata = await fetchJSON(`${ARENA_URL}/api/v1/metadata`);
  const metadata: ChallengeMetadata | undefined = allMetadata[GAME_TYPE];
  if (!metadata) {
    err(`Unknown challenge type "${GAME_TYPE}". Available: ${Object.keys(allMetadata).join(", ")}`);
    process.exit(1);
  }
  ok(`Loaded metadata for "${GAME_TYPE}": ${metadata.description.slice(0, 80)}`);

  // Fetch SKILL.md
  let skillContent: string;
  try {
    skillContent = await fetchText(`${ARENA_URL}/skill.md`);
    // Replace template variable with actual URL
    skillContent = skillContent.replace(/\{\{ARENA_URL\}\}/g, ARENA_URL);
    // Also replace any hardcoded example URLs so models don't copy the wrong port
    skillContent = skillContent.replace(/https?:\/\/localhost:\d+/g, ARENA_URL);
    ok("Loaded SKILL.md from arena");
  } catch {
    err("Could not load SKILL.md from arena — agents will have limited instructions");
    skillContent = "";
  }

  // Register all models with well-formatted names
  const agents = await registerModels(MODELS);

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

  const results: BenchmarkGameResult[] = [];

  if (PARALLEL) {
    const tasks = matchups.map(([a, b], idx) => runGame(a, b, idx + 1, metadata, skillContent, agents));
    const settled = await Promise.allSettled(tasks);
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) results.push(r.value);
    }
  } else {
    for (let i = 0; i < matchups.length; i++) {
      const [a, b] = matchups[i];
      try {
        const result = await runGame(a, b, i + 1, metadata, skillContent, agents);
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
