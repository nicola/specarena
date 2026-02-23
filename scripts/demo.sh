#!/usr/bin/env bash
set -euo pipefail

# ─── Arena Demo Script ───────────────────────────────────────────────
# Spins up two claude -p agents that autonomously play a PSI challenge
# against each other. No interactive Claude Code session needed.
# ─────────────────────────────────────────────────────────────────────

# ─── Colors ───
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
RED='\033[0;31m'
DIM='\033[2m'
BOLD='\033[1m'
RESET='\033[0m'

START_TIME=$(date +%s)
elapsed() { printf "%3ds" $(( $(date +%s) - START_TIME )); }

info()  { printf "${DIM}%s${RESET} ${BOLD}[demo]${RESET} %s\n" "$(elapsed)" "$*"; }
ok()    { printf "${DIM}%s${RESET} ${GREEN}[demo]${RESET} %s\n" "$(elapsed)" "$*"; }
err()   { printf "${DIM}%s${RESET} ${RED}[demo]${RESET} %s\n" "$(elapsed)" "$*" >&2; }

# ─── 1. Resolve arena URL ───
if [[ -n "${ARENA_URL:-}" ]]; then
  : # use as-is
elif [[ -n "${PORT:-}" ]]; then
  ARENA_URL="http://localhost:${PORT}"
else
  ARENA_URL="http://localhost:3001"
fi
# strip trailing slash
ARENA_URL="${ARENA_URL%/}"
info "Arena URL: $ARENA_URL"

# ─── 2. Preflight checks ───
for cmd in claude curl jq; do
  if ! command -v "$cmd" &>/dev/null; then
    err "Required command not found: $cmd"
    exit 1
  fi
done
ok "All required commands available (claude, curl, jq)"

info "Checking arena reachability..."
if ! META=$(curl -sS --max-time 10 "${ARENA_URL}/api/v1/metadata" 2>&1); then
  err "Cannot reach arena at ${ARENA_URL}/api/v1/metadata"
  err "Start the server first:  cd engine && npm start"
  exit 1
fi
if ! echo "$META" | jq -e . &>/dev/null; then
  err "Arena returned invalid JSON from /api/v1/metadata"
  err "Response: $META"
  exit 1
fi
ok "Arena is reachable"

# ─── 3. Load SKILL.md ───
SKILL_CONTENT=""
SKILL_REMOTE="${ARENA_URL}/skill.md"
if SKILL_CONTENT=$(curl -sS --max-time 10 -f "$SKILL_REMOTE" 2>/dev/null) && [[ -n "$SKILL_CONTENT" ]]; then
  ok "Loaded SKILL.md from $SKILL_REMOTE"
else
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  LOCAL_SKILL="${SCRIPT_DIR}/../SKILL.md"
  if [[ -f "$LOCAL_SKILL" ]]; then
    SKILL_CONTENT=$(cat "$LOCAL_SKILL")
    ok "Loaded SKILL.md from $LOCAL_SKILL"
  else
    err "Could not load SKILL.md from $SKILL_REMOTE or $LOCAL_SKILL"
    exit 1
  fi
fi
# Replace {{ARENA_URL}} template variable
SKILL_CONTENT="${SKILL_CONTENT//\{\{ARENA_URL\}\}/$ARENA_URL}"

# ─── 4. Create challenge ───
info "Creating PSI challenge..."
CREATE_RESP=$(curl -sS --max-time 10 -X POST "${ARENA_URL}/api/v1/challenges/psi")
if ! echo "$CREATE_RESP" | jq -e .id &>/dev/null; then
  err "Failed to create challenge. Response: $CREATE_RESP"
  exit 1
fi

CHALLENGE_ID=$(echo "$CREATE_RESP" | jq -r '.id')
INVITE_A=$(echo "$CREATE_RESP" | jq -r '.invites[0]')
INVITE_B=$(echo "$CREATE_RESP" | jq -r '.invites[1]')

ok "Challenge created: $CHALLENGE_ID"
info "  Invite A: $INVITE_A"
info "  Invite B: $INVITE_B"

# ─── 5. Prepare logs & cleanup ───
LOG_DIR=$(mktemp -d)
LOG_A="${LOG_DIR}/agent-1.log"
LOG_B="${LOG_DIR}/agent-2.log"
touch "$LOG_A" "$LOG_B"
info "Logs: $LOG_DIR"

PIDS=()

cleanup() {
  info "Shutting down..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  # kill any tail processes we started
  kill 0 2>/dev/null || true
  ok "Logs preserved at: $LOG_DIR"
}
trap cleanup EXIT INT TERM

# ─── Agent prompt builder ───
build_prompt() {
  local invite="$1"
  local player_num="$2"
  cat <<PROMPT
You are Agent ${player_num} in an Arena PSI challenge.

## Your Details
- Arena URL: ${ARENA_URL}
- Challenge ID: ${CHALLENGE_ID}
- Your invite code: ${invite}

## Instructions

You must complete the full challenge flow using curl commands. Follow these steps:

### Step 1: Join the challenge

First, try AUTH MODE (Ed25519 signature). Generate keys and sign using Node.js:

\`\`\`bash
# Generate keys and sign the join message
INVITE="${invite}"
TIMESTAMP=\$(date +%s000)

KEYS=\$(node -e "
const crypto = require('crypto');
const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
const pubHex = publicKey.export({ type: 'spki', format: 'der' }).toString('hex');
const privHex = privateKey.export({ type: 'pkcs8', format: 'der' }).toString('hex');
console.log(JSON.stringify({ publicKey: pubHex, privateKey: privHex }));
")

PUB_KEY=\$(echo "\$KEYS" | jq -r '.publicKey')
PRIV_KEY=\$(echo "\$KEYS" | jq -r '.privateKey')

# Sign the join message
MESSAGE="arena:v1:join:\${INVITE}:\${TIMESTAMP}"
SIGNATURE=\$(node -e "
const crypto = require('crypto');
const privKey = crypto.createPrivateKey({
  key: Buffer.from('\${PRIV_KEY}', 'hex'),
  format: 'der',
  type: 'pkcs8'
});
const sig = crypto.sign(null, Buffer.from('\${MESSAGE}'), privKey);
console.log(sig.toString('hex'));
")
\`\`\`

Then join:
\`\`\`bash
curl -sS --max-time 10 -X POST ${ARENA_URL}/api/v1/arena/join \\
  -H "Content-Type: application/json" \\
  -d "{\"invite\": \"\${INVITE}\", \"publicKey\": \"\${PUB_KEY}\", \"signature\": \"\${SIGNATURE}\", \"timestamp\": \${TIMESTAMP}}"
\`\`\`

If auth mode join succeeds, save the sessionKey from the response. Use it as "Authorization: Bearer <sessionKey>" on ALL subsequent requests. Do NOT send "from" in subsequent requests — the server resolves your identity from the session key.

If auth mode join fails (e.g. the server doesn't require signatures), fall back to STANDALONE MODE:
\`\`\`bash
curl -sS --max-time 10 -X POST ${ARENA_URL}/api/v1/arena/join \\
  -H "Content-Type: application/json" \\
  -d '{"invite": "${invite}"}'
\`\`\`
In standalone mode, use your invite code as "from" in all subsequent requests.

### Step 2: Get your private data

Sync the challenge channel for operator messages:
- Auth mode: \`GET ${ARENA_URL}/api/v1/arena/sync?channel=${CHALLENGE_ID}&index=0\` with Authorization header
- Standalone: \`GET ${ARENA_URL}/api/v1/arena/sync?channel=${CHALLENGE_ID}&from=${invite}&index=0\`

Look for messages from "operator" addressed to you. These contain your private set of items.

### Step 3: Chat with your opponent

Send a message to start negotiation. Try to learn what items your opponent has WITHOUT revealing all of yours. This is a Private Set Intersection challenge — you want to find shared items.

- Auth mode: POST to ${ARENA_URL}/api/v1/chat/send with {"channel": "${CHALLENGE_ID}", "content": "your message"} and Authorization header
- Standalone: POST with {"channel": "${CHALLENGE_ID}", "from": "${invite}", "content": "your message"}

Read opponent messages:
- GET ${ARENA_URL}/api/v1/chat/sync?channel=${CHALLENGE_ID}&from=${invite}&index=0

Exchange a few messages (3-5 rounds) to figure out the intersection.

### Step 4: Submit your guess

Once you have enough information, submit the intersection:
- Auth mode: POST to ${ARENA_URL}/api/v1/arena/message with {"challengeId": "${CHALLENGE_ID}", "messageType": "guess", "content": "item1,item2,..."} and Authorization header
- Standalone: POST with {"challengeId": "${CHALLENGE_ID}", "from": "${invite}", "messageType": "guess", "content": "item1,item2,..."}

The content should be a comma-separated list of items you believe are in both players' sets.

### Step 5: Check results

After submitting, sync again to get your scores from the operator.

## Important Rules
- Always use -sS --max-time 10 with curl
- Parse JSON responses with jq when needed
- Be strategic: don't reveal all your items at once
- Complete ALL steps — join, read data, chat, guess, check scores
PROMPT
}

# ─── 6. Launch agents ───
PROMPT_A=$(build_prompt "$INVITE_A" 1)
PROMPT_B=$(build_prompt "$INVITE_B" 2)

info "Launching Agent 1..."
claude -p "$PROMPT_A" \
  --append-system-prompt "$SKILL_CONTENT" \
  --dangerously-skip-permissions \
  --allowedTools "Bash" \
  --model sonnet \
  --no-session-persistence \
  > "$LOG_A" 2>&1 &
PIDS+=($!)
ok "Agent 1 started (PID ${PIDS[0]})"

info "Launching Agent 2..."
claude -p "$PROMPT_B" \
  --append-system-prompt "$SKILL_CONTENT" \
  --dangerously-skip-permissions \
  --allowedTools "Bash" \
  --model sonnet \
  --no-session-persistence \
  > "$LOG_B" 2>&1 &
PIDS+=($!)
ok "Agent 2 started (PID ${PIDS[1]})"

# ─── 7. Stream colored output with milestone detection ───
info "Streaming agent output (Ctrl+C to stop)..."
echo ""

# Awk script that adds elapsed timestamps and highlights key events
# Milestones: join/session, operator data, chat send, guess submit, score
read -r -d '' AWK_STREAM <<'AWKEOF' || true
BEGIN {
  bold   = "\033[1m"
  dim    = "\033[2m"
  green  = "\033[0;32m"
  yellow = "\033[0;33m"
  red    = "\033[0;31m"
  reset  = "\033[0m"
}
{
  now = systime()
  el  = now - start
  ts  = sprintf("%3ds", el)
  prefix = dim ts reset " " color tag " " reset

  line = $0

  # Detect milestones and add a marker
  marker = ""
  if (line ~ /sessionKey/ || line ~ /ChallengeID/ || line ~ /"joined"/)
    marker = green bold " ✔ JOINED" reset
  else if (line ~ /operator/ && line ~ /private|items|set/)
    marker = green bold " ✔ GOT PRIVATE DATA" reset
  else if (line ~ /chat\/send/ || line ~ /send_chat/)
    marker = yellow bold " → CHAT" reset
  else if (line ~ /messageType.*guess/ || line ~ /"guess"/)
    marker = yellow bold " → GUESS SUBMITTED" reset
  else if (line ~ /[Ss]core/ || line ~ /[Uu]tility/ || line ~ /[Ss]ecurity/)
    marker = green bold " ★ SCORE" reset
  else if (line ~ /[Ee]rror/ || line ~ /[Ff]ailed/ || line ~ /HTTP\/[0-9]+ [45]/)
    marker = red bold " ✘ ERROR" reset

  # Truncate very long lines (raw JSON blobs)
  if (length(line) > 300) {
    line = substr(line, 1, 297) "..."
  }

  print prefix line marker
  fflush()
}
AWKEOF

tail -f "$LOG_A" 2>/dev/null | awk \
  -v start="$START_TIME" -v color="$CYAN" -v tag="[Agent 1]" \
  "$AWK_STREAM" &
PIDS+=($!)

tail -f "$LOG_B" 2>/dev/null | awk \
  -v start="$START_TIME" -v color="$MAGENTA" -v tag="[Agent 2]" \
  "$AWK_STREAM" &
PIDS+=($!)

# ─── 8. Live game-state monitor ───
# Polls the arena every 5 seconds and prints a compact status line
monitor_game() {
  local url="$1" cid="$2" inv_a="$3" inv_b="$4"
  local prev_status=""

  while true; do
    sleep 5

    # Fetch arena sync (as viewer — sees broadcast messages)
    local sync_data
    sync_data=$(curl -sS --max-time 5 \
      "${url}/api/v1/arena/sync?channel=${cid}&from=viewer&index=0" 2>/dev/null) || continue
    echo "$sync_data" | jq -e '.' &>/dev/null || continue

    local total joined guesses scored
    total=$(echo "$sync_data" | jq 'length')
    joined=$(echo "$sync_data" | jq '[.[] | select(.content != null and (.content | test("joined|ChallengeID"; "i")))] | length' 2>/dev/null || echo 0)
    guesses=$(echo "$sync_data" | jq '[.[] | select(.messageType == "guess")] | length' 2>/dev/null || echo 0)
    scored=$(echo "$sync_data" | jq '[.[] | select(.from == "operator" and (.content | test("score|utility|security"; "i")))] | length' 2>/dev/null || echo 0)

    # Chat message count
    local chat_data chat_count
    chat_data=$(curl -sS --max-time 5 \
      "${url}/api/v1/chat/sync?channel=${cid}&from=viewer&index=0" 2>/dev/null) || continue
    chat_count=0
    if echo "$chat_data" | jq -e '.' &>/dev/null; then
      chat_count=$(echo "$chat_data" | jq 'length')
    fi

    local status="msgs=${total} chat=${chat_count} guesses=${guesses} scores=${scored}"

    # Only print when something changed
    if [[ "$status" != "$prev_status" ]]; then
      local el=$(( $(date +%s) - START_TIME ))
      printf "${DIM}%3ds${RESET} ${BOLD}${YELLOW}[monitor]${RESET} arena: %s msgs, %s chat, %s guesses, %s scores\n" \
        "$el" "$total" "$chat_count" "$guesses" "$scored"
      prev_status="$status"
    fi

    # Stop when both agents have scores
    if [[ "$scored" -ge 2 ]]; then
      break
    fi
  done
}

monitor_game "$ARENA_URL" "$CHALLENGE_ID" "$INVITE_A" "$INVITE_B" &
MONITOR_PID=$!
PIDS+=($MONITOR_PID)

# ─── 9. Wait for agents & summarize ───
AGENT1_PID=${PIDS[0]}
AGENT2_PID=${PIDS[1]}

wait "$AGENT1_PID" 2>/dev/null || true
A1_EXIT=$?
A1_ELAPSED=$(( $(date +%s) - START_TIME ))
ok "Agent 1 finished (exit=$A1_EXIT, ${A1_ELAPSED}s)"

wait "$AGENT2_PID" 2>/dev/null || true
A2_EXIT=$?
A2_ELAPSED=$(( $(date +%s) - START_TIME ))
ok "Agent 2 finished (exit=$A2_EXIT, ${A2_ELAPSED}s)"

# Stop the monitor
kill "$MONITOR_PID" 2>/dev/null || true

# Give logs a moment to flush
sleep 1

TOTAL_ELAPSED=$(( $(date +%s) - START_TIME ))

echo ""
printf "${BOLD}═══════════════════════════════════════════════════════════${RESET}\n"
printf "${BOLD}  Final Game Summary  (total: %ds)${RESET}\n" "$TOTAL_ELAPSED"
printf "${BOLD}═══════════════════════════════════════════════════════════${RESET}\n"
echo ""

# ─── Chat transcript ───
CHAT_SYNC=$(curl -sS --max-time 10 \
  "${ARENA_URL}/api/v1/chat/sync?channel=${CHALLENGE_ID}&from=viewer&index=0" 2>/dev/null || echo "[]")

if echo "$CHAT_SYNC" | jq -e '. | length > 0' &>/dev/null; then
  CHAT_COUNT=$(echo "$CHAT_SYNC" | jq 'length')
  printf "${BOLD}  Chat transcript (%s messages):${RESET}\n" "$CHAT_COUNT"
  echo "$CHAT_SYNC" | jq -r '
    .[] |
    if .from | test("inv_") then
      "    \(.from[0:10])…  \(.content // "[redacted]")"
    else
      "    \(.from):  \(.content // "[redacted]")"
    end
  ' 2>/dev/null | head -40 || true
  echo ""
fi

# ─── Arena messages & scores ───
FINAL_SYNC=$(curl -sS --max-time 10 \
  "${ARENA_URL}/api/v1/arena/sync?channel=${CHALLENGE_ID}&from=viewer&index=0" 2>/dev/null || echo "[]")

if echo "$FINAL_SYNC" | jq -e '.' &>/dev/null; then
  # Guesses
  GUESSES=$(echo "$FINAL_SYNC" | jq -r '
    [.[] | select(.messageType == "guess")] |
    if length > 0 then
      .[] | "    \(.from[0:10])…  →  \(.content)"
    else
      empty
    end
  ' 2>/dev/null || echo "")

  if [[ -n "$GUESSES" ]]; then
    printf "${BOLD}  Guesses submitted:${RESET}\n"
    echo "$GUESSES"
    echo ""
  fi

  # Score messages from operator
  SCORES=$(echo "$FINAL_SYNC" | jq -r '
    [.[] | select(.from == "operator" and .to != null and (.content | test("score|utility|security|correct|accuracy"; "i")))] |
    if length > 0 then
      .[] | "    → \(.to[0:10])…  \(.content)"
    else
      empty
    end
  ' 2>/dev/null || echo "")

  if [[ -n "$SCORES" ]]; then
    printf "${GREEN}${BOLD}  Scores:${RESET}\n"
    echo "$SCORES"
    echo ""
  else
    printf "${YELLOW}  No score messages found. Last 5 arena messages:${RESET}\n"
    echo "$FINAL_SYNC" | jq -r '
      .[-5:] | .[] | "    [\(.from) → \(.to // "broadcast")] \(.content[0:120])"
    ' 2>/dev/null || true
    echo ""
  fi
else
  info "Could not fetch final game state"
fi

# ─── Agent stats ───
printf "${BOLD}  Agent stats:${RESET}\n"
printf "    Agent 1: exit=%d  runtime=%ds  log=%s (%s lines)\n" \
  "$A1_EXIT" "$A1_ELAPSED" "$LOG_A" "$(wc -l < "$LOG_A" | tr -d ' ')"
printf "    Agent 2: exit=%d  runtime=%ds  log=%s (%s lines)\n" \
  "$A2_EXIT" "$A2_ELAPSED" "$LOG_B" "$(wc -l < "$LOG_B" | tr -d ' ')"
echo ""
printf "${BOLD}═══════════════════════════════════════════════════════════${RESET}\n"
ok "Demo complete. Logs at: $LOG_DIR"
