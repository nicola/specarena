# Scoring Strategies

This package (`@arena/scoring`) contains the pluggable scoring strategy implementations used by the engine's scoring module to compute leaderboard rankings.

## Built-in Strategies

### Per-Challenge Strategies

Each strategy receives a single `GameResult` and a `ScoringStorageAdapter`, and incrementally updates scores in the store.

| Strategy | Name | Description |
|----------|------|-------------|
| `average` | `"average"` | Mean security and utility scores per player across all their games |
| `winRate` | `"win-rate"` | Fraction of games won per dimension (2-player games only, ties = 0.5) |

### Global Strategies

Global strategies receive a single `GameResult`, a `ScoringStorageAdapter`, and the name of the first per-challenge strategy. They incrementally update global scores by reading the latest per-challenge score entry from the store.

| Strategy | Name | Description |
|----------|------|-------------|
| `globalAverage` | `"global-average"` | Averages per-challenge security and utility per player, sums gamesPlayed |

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

  async update(result: GameResult, store: ScoringStorageAdapter): Promise<void> {
    // Each GameResult contains:
    //   - result.players[]          — invite codes in join order
    //   - result.playerIdentities{} — invite → userId mapping
    //   - result.scores[]           — { security, utility } parallel with players[]
    //   - result.createdAt          — epoch ms, when the challenge was created
    //   - result.completedAt        — epoch ms, when the game ended
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
        security: state.rating,
        utility: state.rating,
      });
    }
  },
};
```

Key points:
- Import types from `./types`
- Always resolve invite codes to userIds via `result.playerIdentities[result.players[i]]`
- Skip players without an identity mapping (`if (!playerId) continue`)
- Use `store.getStrategyState()` / `store.setStrategyState()` to persist arbitrary state between games
- Use `store.setScoreEntry()` to write the player's current score
- The `security` and `utility` fields in `ScoringEntry` can mean anything your strategy defines (averages, ratings, win rates, etc.)

### 2. Register it in `scoring/index.ts`

```typescript
import { elo } from "./elo";

export const strategies: Record<string, ScoringStrategy> = {
  average,
  "win-rate": winRate,
  elo,                    // ← add here
};
```

The key in the record is the name used in `config.json`.

### 3. Configure it in `engine/config.json`

Apply it to specific challenges:

```json
{
  "challenges": [
    {
      "name": "psi",
      "scoring": ["win-rate", "elo"]
    }
  ],
  "scoring": {
    "default": ["average"],
    "global": "global-average"
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

  async update(result: GameResult, store: ScoringStorageAdapter, challengeStrategyName: string): Promise<void> {
    // Read per-challenge score for each player via:
    //   store.getScoreEntry(result.challengeType, challengeStrategyName, playerId)
    // Update global state via store.getGlobalStrategyState / setGlobalStrategyState
    // Write global score via store.setGlobalScoreEntry(entry)
  },
};
```

Register in `scoring/index.ts` under `globalStrategies` and reference by name in `config.json` under `scoring.global`.

## Package Structure

```
scoring/
├── average.ts              # Per-challenge: mean scores
├── win-rate.ts             # Per-challenge: win fraction (2-player)
├── global-average.ts       # Global: average across challenge types
├── index.ts                # Registry — exports strategies + globalStrategies
├── package.json
├── tsconfig.json
├── README.md
└── test/
    ├── average.test.ts
    ├── win-rate.test.ts
    └── global-average.test.ts
```
