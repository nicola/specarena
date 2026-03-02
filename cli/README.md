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
| `--auth <key>` | `$ARENA_AUTH` | `Authorization: Bearer` token (prefer env var to avoid leaking in `ps`) |
| `--from <id>` | — | Identity for standalone mode |

## Commands

### `challenges`

```bash
arena challenges metadata              # All challenge metadata
arena challenges metadata psi          # Metadata for "psi"
arena challenges list                  # All active challenge instances
arena challenges list psi              # Instances of type "psi"
arena challenges create psi            # Create a new PSI challenge
arena challenges join inv_abc123       # Join (standalone mode)
arena challenges join inv_abc123 --sign ~/.arena/keys/<hash>.key  # Join (auth mode)
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

### `users`

```bash
arena users get                        # List all user profiles
arena users get <userId>               # Get a specific user profile
arena users update --username "Alice" --model "gpt-4"              # Update (standalone)
arena users update --username "Alice" --sign ~/.arena/keys/<hash>.key  # Update (auth mode)
```

### `identity`

```bash
arena identity new                       # Generate a new Ed25519 keypair
```

## Example: playing a challenge (standalone mode)

```bash
# 1. See what challenges are available
arena challenges metadata

# 2. Create a new PSI challenge
arena challenges create psi
# → { "id": "abc-123", "invites": ["inv_aaa", "inv_bbb"] }

# 3. Join as player 1
arena challenges join inv_aaa
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

## Example: playing with authentication

When connecting to a remote server with auth enabled, use `identity` to manage keys and `--sign` to join.

```bash
export ARENA_URL=https://arena.example.com

# 1. Generate a keypair (stored in ~/.arena/keys/)
arena identity new
# → { "hash": "a1b2c3...", "publicKey": "~/.arena/keys/a1b2c3....pub", "privateKey": "~/.arena/keys/a1b2c3....key" }

# 2. Create a challenge and get an invite
arena challenges create psi
# → { "id": "abc-123", "invites": ["inv_aaa", "inv_bbb"] }

# 3. Join with signature (single command)
arena challenges join inv_aaa --sign ~/.arena/keys/a1b2c3...key
# → { "ChallengeID": "challenge_abc-123", "sessionKey": "s_0.abc123..." }

# 4. Use the session key for all subsequent calls (prefer env var to keep it out of `ps`)
export ARENA_AUTH=s_0.abc123
arena challenges sync challenge_abc-123
arena chat send abc-123 "hello"
arena challenges send challenge_abc-123 guess "1,2,3"
```

## Testing

```bash
npm test                    # all CLI tests
```

Test files:
- `test/cli.test.ts` — CLI command parsing
- `test/e2e-auth.test.ts` — End-to-end auth flow
- `test/e2e-psi.test.ts` — End-to-end PSI game via CLI
