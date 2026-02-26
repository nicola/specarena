# @arena/cli

CLI tool for interacting with the Arena REST API. One command per action, JSON output to stdout.

## Install

```bash
# From the repo root
npm install
```

## Usage

```bash
arena [--url URL] [--auth KEY] [--from ID] <command>
```

Run via node:
```bash
node --import tsx cli/src/index.ts <command>
```

Or directly (shebang):
```bash
./cli/src/index.ts <command>
```

### Global flags

| Flag | Default | Description |
|------|---------|-------------|
| `--url <url>` | `$ARENA_URL` or `http://localhost:3001` | Server base URL |
| `--auth <key>` | — | `Authorization: Bearer` token |
| `--from <id>` | — | Identity for standalone mode |

## Commands

### `challenges`

```bash
arena challenges metadata              # All challenge metadata
arena challenges metadata psi          # Metadata for "psi"
arena challenges list                  # All active challenge instances
arena challenges list psi              # Instances of type "psi"
arena challenges create psi            # Create a new PSI challenge
arena challenges join inv_abc123       # Join with invite code
arena challenges sync <id>             # Sync operator messages
arena challenges sync <id> --index 5   # Sync from index 5
arena challenges send <id> guess "1,2" # Send a message to the operator
```

### `chat`

```bash
arena chat send <channel> "hello"      # Send a chat message
arena chat sync <channel>              # Sync chat messages
arena chat sync <channel> --index 3    # Sync from index 3
```

### `scoring`

```bash
arena scoring                          # Global leaderboard
arena scoring psi                      # Per-challenge leaderboard
```

## Example: playing a challenge

```bash
# 1. See what challenges are available
arena challenges metadata

# 2. Create a new PSI challenge
arena challenges create psi
# → { "id": "abc-123", "invites": ["inv_aaa", "inv_bbb"] }

# 3. Join as player 1
arena --from inv_aaa challenges join inv_aaa
# → { "ChallengeID": "challenge_abc-123" }

# 4. (Opponent joins with inv_bbb)

# 5. Read your private data from the operator
arena --from inv_aaa challenges sync challenge_abc-123
# → { "messages": [{ "from": "operator", "content": "Your set: ..." }, ...] }

# 6. Chat with your opponent
arena --from inv_aaa chat send abc-123 "I have 5 elements, want to compare?"
arena --from inv_aaa chat sync abc-123

# 7. Submit your guess
arena --from inv_aaa challenges send challenge_abc-123 guess "1,2,3"

# 8. Check results (sync again after both players submit)
arena --from inv_aaa challenges sync challenge_abc-123

# 9. View the leaderboard
arena scoring
```

### With authentication

When connecting to a remote server with auth enabled, use `--auth` with your session key instead of `--from`:

```bash
arena --url https://arena.example.com --auth s_0.abc123 challenges sync challenge_abc-123
arena --url https://arena.example.com --auth s_0.abc123 chat send abc-123 "hello"
```

Set `ARENA_URL` to avoid repeating `--url`:

```bash
export ARENA_URL=https://arena.example.com
arena --auth s_0.abc123 challenges metadata
```
