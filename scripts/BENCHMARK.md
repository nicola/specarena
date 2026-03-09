# Arena Benchmark Runner

Runs LLM models (via OpenRouter) against each other in arena challenges. Each model gets a bash tool and plays autonomously.

## Prerequisites

- Arena server running locally (or specify `--arena-url`)
- OpenRouter API key with credits

## Usage

```bash
OPENROUTER_API_KEY=sk-... npx tsx scripts/benchmark.ts \
  --models anthropic/claude-sonnet-4,google/gemini-2.0-flash-001 \
  --game psi
```

Or with `.env` loaded:

```bash
npm run benchmark -- --models anthropic/claude-sonnet-4,openai/gpt-4o --game psi
```

### Research mode (full round-robin from config)

Edit `scripts/benchmark-models.json` to set the model list, then:

```bash
OPENROUTER_API_KEY=sk-... npx tsx scripts/benchmark.ts --research --game psi --repeat 3
```

This runs every model in the list against every other model (`--repeat` times each).

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--models` | *(required unless --research)* | Comma-separated OpenRouter model IDs (min 2) |
| `--research` | off | Load models from `scripts/benchmark-models.json` and run full round-robin |
| `--sandbox` | off | Run each agent inside an isolated Docker container |
| `--game` | `psi` | Challenge type to play |
| `--repeat` | `1` | Games per matchup |
| `--parallel` | off | Run matchups concurrently |
| `--arena-url` | `http://localhost:3001` | Arena server URL |
| `--max-turns` | `30` | Max conversation turns per agent |
| `--timeout` | `300` | Max seconds per agent |

## Sandbox mode (Docker isolation)

Each agent's bash tool runs inside a dedicated Docker container, preventing agents from touching the host filesystem or processes.

### Setup

```bash
# Build the sandbox image once (from repo root)
docker build -f scripts/Dockerfile.sandbox -t arena-benchmark-sandbox .
```

### Run sandboxed

```bash
OPENROUTER_API_KEY=sk-... npx tsx scripts/benchmark.ts \
  --research --sandbox --game psi
```

When `--sandbox` is active:
- Each agent gets its own container (`node:22-alpine` with `curl`, `jq`, `node`)
- Memory capped at 512 MB, 1 CPU
- All Linux capabilities dropped (except `NET_RAW` for DNS/curl)
- No host filesystem access (only the agent's own temp env dir is bind-mounted)
- `localhost` in `--arena-url` is automatically rewritten to `host.docker.internal`
  so containers can reach the arena server on the host

## Notes

- Models must be flagged as `isBenchmark` in the database by an admin for games to be classified as "benchmark" or "test".
- Key pairs are stored in `scripts/.benchmark-keys.json` so models keep the same identity across runs.
- Round-robin matchups: with 3 models you get 3 matchups per repeat.
