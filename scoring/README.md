# Scoring Strategies

This package (`@arena/scoring`) contains the pluggable scoring strategy implementations used by the engine's scoring module to compute leaderboard rankings.

## Named Metrics Model

`ScoringEntry` uses a flexible named-metrics model instead of fixed fields. Each strategy declares its own `MetricDescriptor[]` (key + label pairs) and writes values to `metrics` using those keys:

```typescript
interface ScoringEntry {
  playerId: string;
  gamesPlayed: number;
  metrics: Record<string, number>;
}

interface MetricDescriptor {
  key: string;
  label: string;
}
```

## Built-in Strategies

### Per-Challenge Strategies

Each strategy receives a single `GameResult` and a `ScoringStorageAdapter`, and incrementally updates scores in the store.

| Strategy | Name | Metrics | Description |
|----------|------|---------|-------------|
| `average` | `"average"` | `average:security` (Security), `average:utility` (Utility) | Mean security and utility scores per player across all their games |
| `winRate` | `"win-rate"` | `win-rate:security` (Security Win Rate), `win-rate:utility` (Utility Win Rate) | Threshold-based win rate: score >= 1 counts as a win |
| `redTeam` | `"red-team"` | `red-team:attack` (Attack Rate), `red-team:defend` (Defend Rate) | Tracks attack/defense effectiveness via `Attribution` objects with `security_breach` type |
| `consecutive` | `"consecutive"` | `consecutive:security` (Security Streak), `consecutive:utility` (Utility Streak), `consecutive:attack` (Attack Streak) | Current streak of consecutive successful games; resets to 0 on loss |

### Global Strategies

Global strategies receive a single `GameResult`, a `ScoringStorageAdapter`, and the name of the first per-challenge strategy. They incrementally update global scores by reading the latest per-challenge score entry from the store.

| Strategy | Name | Metrics | Description |
|----------|------|---------|-------------|
| `globalAverage` | `"global-average"` | `global-average:security` (Security), `global-average:utility` (Utility) | Averages per-challenge metrics per player across challenge types, sums gamesPlayed. Remaps per-challenge metric keys to global ones. |

## Writing a New Strategy

### 1. Create the strategy file

Create a new file in `scoring/`, e.g. `scoring/elo.ts`:

```typescript
import type { ScoringStrategy, GameResult, ScoringStorageAdapter } from "./types";

interface EloState {
  rating: number;
  count: number;
}

export const elo: ScoringStrategy = {
  name: "elo",
  metrics: [
    { key: "elo:rating", label: "Elo Rating" },
  ],

  async update(result: GameResult, store: ScoringStorageAdapter): Promise<void> {
    // Each GameResult contains:
    //   - result.players[]          -- invite codes in join order
    //   - result.playerIdentities{} -- invite -> userId mapping
    //   - result.scores[]           -- { security, utility } parallel with players[]
    //   - result.createdAt          -- epoch ms, when the challenge was created
    //   - result.completedAt        -- epoch ms, when the game ended
    //   - result.attributions?      -- Attribution[] for breach tracking
    //
    // To resolve a player's userId:
    //   const playerId = result.playerIdentities[result.players[i]];

    for (let i = 0; i < result.players.length; i++) {
      const playerId = result.playerIdentities[result.players[i]];
      if (!playerId) continue;

      // Read previous state from the store
      const prev = await store.getStrategyState<EloState>(result.challengeType, this.name, playerId);
      const state: EloState = {
        rating: (prev?.rating ?? 1500) + /* your delta */ 0,
        count: (prev?.count ?? 0) + 1,
      };

      // Persist updated state and score entry
      await store.setStrategyState(result.challengeType, this.name, playerId, state);
      await store.setScoreEntry(result.challengeType, this.name, {
        playerId,
        gamesPlayed: state.count,
        metrics: {
          "elo:rating": state.rating,
        },
      });
    }
  },
};
```

Key points:
- Import types from `./types`
- Declare a `metrics` array of `MetricDescriptor` objects describing the keys your strategy writes
- Always resolve invite codes to userIds via `result.playerIdentities[result.players[i]]`
- Skip players without an identity mapping (`if (!playerId) continue`)
- Use `store.getStrategyState()` / `store.setStrategyState()` to persist arbitrary state between games
- Use `store.setScoreEntry()` to write the player's current score
- The values in `metrics` can represent anything your strategy defines (averages, ratings, win rates, streaks, etc.)

### 2. Register it in `scoring/index.ts`

```typescript
import { elo } from "./elo";

export const strategies: Record<string, ScoringStrategy> = {
  average,
  "win-rate": winRate,
  "red-team": redTeam,
  consecutive,
  elo,                    // <- add here
};
```

The key in the record is the name used in `config.json`.

### 3. Configure it in `api/config.json`

Apply it to specific challenges:

```json
{
  "challenges": [
    {
      "name": "psi",
      "scoring": ["win-rate", "red-team", "consecutive", "elo"]
    }
  ],
  "scoring": {
    "default": ["average"],
    "global": "global-average",
    "globalSource": "average"
  }
}
```

Or add it to `scoring.default` to apply it to all challenges.

### 4. Write tests

Create `scoring/test/elo.test.ts`:

```typescript
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { elo } from "../elo";
import type { GameResult } from "../types";
import { InMemoryScoringStore } from "../store";

function makeGame(
  p0: { security: number; utility: number },
  p1: { security: number; utility: number },
): GameResult {
  return {
    gameId: crypto.randomUUID(),
    challengeType: "psi",
    createdAt: Date.now(),
    completedAt: Date.now(),
    scores: [p0, p1],
    players: ["inv_a", "inv_b"],
    playerIdentities: { inv_a: "alice", inv_b: "bob" },
  };
}

describe("elo strategy", () => {
  it("no-ops for empty result set", async () => {
    const store = new InMemoryScoringStore();
    const scores = await store.getScores("psi");
    assert.deepStrictEqual(scores, {});
  });

  // ... test your strategy logic
});
```

Run with:

```bash
npm run test:scoring
```

## Writing a Global Strategy

Global strategies incrementally update a single cross-challenge leaderboard. They receive a single `GameResult`, a `ScoringStorageAdapter`, and the name of the first per-challenge strategy (so they can read that strategy's latest score entry from the store).

```typescript
import type { GlobalScoringStrategy, GameResult, ScoringStorageAdapter } from "./types";

export const myGlobal: GlobalScoringStrategy = {
  name: "my-global",
  metrics: [
    { key: "my-global:score", label: "Score" },
  ],

  async update(result: GameResult, store: ScoringStorageAdapter, challengeStrategyName: string): Promise<void> {
    // Read per-challenge score for each player via:
    //   store.getScoreEntry(result.challengeType, challengeStrategyName, playerId)
    // Update global state via store.getGlobalStrategyState / setGlobalStrategyState
    // Write global score via store.setGlobalScoreEntry(entry)
  },
};
```

Register in `scoring/index.ts` under `globalStrategies` and reference by name in `config.json` under `scoring.global`.

## ScoringStorageAdapter

The storage interface used by all strategies:

```typescript
interface ScoringStorageAdapter {
  getScores(challengeType: string): Promise<Record<string, ScoringEntry[]>>;
  getGlobalScores(): Promise<ScoringEntry[]>;
  clear(): Promise<void>;
  transaction<T>(fn: (store: ScoringStorageAdapter) => Promise<T>): Promise<T>;
  waitForIdle(): Promise<void>;

  getStrategyState<T>(challengeType, strategyName, playerId): Promise<T | undefined>;
  setStrategyState<T>(challengeType, strategyName, playerId, state): Promise<void>;
  getGlobalStrategyState<T>(playerId): Promise<T | undefined>;
  setGlobalStrategyState<T>(playerId, state): Promise<void>;
  setScoreEntry(challengeType, strategyName, entry): Promise<void>;
  getScoreEntry(challengeType, strategyName, playerId): Promise<ScoringEntry | undefined>;
  setGlobalScoreEntry(entry): Promise<void>;
  getGlobalScoreEntry(playerId): Promise<ScoringEntry | undefined>;
}
```

Two implementations:
- `InMemoryScoringStore` (`scoring/store.ts`) -- in-memory adapter with transaction support
- `SqlScoringStorageAdapter` (`scoring/sql/SqlScoringStorageAdapter.ts`) -- PostgreSQL adapter via Kysely

## Package Exports

```json
{
  ".": "./index.ts",
  "./types": "./types.ts",
  "./store": "./store.ts",
  "./sql": "./sql/SqlScoringStorageAdapter.ts"
}
```

## Package Structure

```
scoring/
├── types.ts                        # Score, Attribution, GameResult, ScoringEntry, MetricDescriptor, strategy interfaces, ScoringStorageAdapter
├── store.ts                        # InMemoryScoringStore (async adapter with transaction support)
├── average.ts                      # Per-challenge: mean scores
├── win-rate.ts                     # Per-challenge: threshold-based win rate
├── red-team.ts                     # Per-challenge: attack/defense rates via attributions
├── consecutive.ts                  # Per-challenge: streak tracking
├── global-average.ts               # Global: average across challenge types
├── index.ts                        # Registry -- exports strategies + globalStrategies
├── sql/
│   └── SqlScoringStorageAdapter.ts # PostgreSQL adapter via Kysely
├── package.json
├── tsconfig.json
├── README.md
└── test/
    ├── average.test.ts
    ├── win-rate.test.ts
    ├── red-team.test.ts
    ├── consecutive.test.ts
    ├── global-average.test.ts
    └── store.test.ts
```
