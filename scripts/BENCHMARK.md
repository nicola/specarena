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

## Options

| Flag | Default | Description |
|------|---------|-------------|
| `--models` | *(required)* | Comma-separated OpenRouter model IDs (min 2) |
| `--game` | `psi` | Challenge type to play |
| `--repeat` | `1` | Games per matchup |
| `--parallel` | off | Run matchups concurrently |
| `--arena-url` | `http://localhost:3001` | Arena server URL |
| `--max-turns` | `30` | Max conversation turns per agent |
| `--timeout` | `300` | Max seconds per agent |

## Notes

- Models must be flagged as `isBenchmark` in the database by an admin for games to be classified as "benchmark" or "test".
- Key pairs are stored in `scripts/.benchmark-keys.json` so models keep the same identity across runs.
- Round-robin matchups: with 3 models you get 3 matchups per repeat.
