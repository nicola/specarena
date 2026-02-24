# Scoring Strategies

This package (`@arena/scoring`) contains the pluggable scoring strategy implementations used by the engine's scoring module to compute leaderboard rankings.

## Built-in Strategies

### Per-Challenge Strategies

These take `GameResult[]` for a single challenge type and produce `ScoringEntry[]`.

| Strategy | Name | Description |
|----------|------|-------------|
| `average` | `"average"` | Mean security and utility scores per player across all their games |
| `winRate` | `"win-rate"` | Fraction of games won per dimension (2-player games only, ties = 0.5) |

### Global Strategies

These take per-challenge `ScoringEntry[]` results and combine them into a single leaderboard.

| Strategy | Name | Description |
|----------|------|-------------|
| `globalAverage` | `"global-average"` | Averages per-challenge security and utility per player, sums gamesPlayed |

## Writing a New Strategy

### 1. Create the strategy file

Create a new file in `scoring/`, e.g. `scoring/elo.ts`:

```typescript
import type { ScoringStrategy, GameResult, ScoringEntry } from "@arena/engine/scoring/types";

export const elo: ScoringStrategy = {
  name: "elo",

  compute(results: GameResult[]): ScoringEntry[] {
    // Each GameResult contains:
    //   - result.players[]          — invite codes in join order
    //   - result.playerIdentities{} — invite → userId mapping
    //   - result.scores[]           — { security, utility } parallel with players[]
    //
    // To resolve a player's userId:
    //   const playerId = result.playerIdentities[result.players[i]];
    //
    // Return one ScoringEntry per player with:
    //   - playerId:    the resolved userId (skip players without identity)
    //   - gamesPlayed: number of games this player participated in
    //   - security:    the computed metric for the security dimension
    //   - utility:     the computed metric for the utility dimension

    // ... your implementation here ...

    return [];
  },
};
```

Key points:
- Import types from `@arena/engine/scoring/types`
- Always resolve invite codes to userIds via `result.playerIdentities[result.players[i]]`
- Skip players without an identity mapping (`if (!playerId) continue`)
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
import type { GameResult } from "@arena/engine/scoring/types";

function makeGame(
  p0: { security: number; utility: number },
  p1: { security: number; utility: number },
): GameResult {
  return {
    gameId: crypto.randomUUID(),
    challengeType: "psi",
    completedAt: Date.now(),
    scores: [p0, p1],
    players: ["inv_a", "inv_b"],
    playerIdentities: { inv_a: "alice", inv_b: "bob" },
  };
}

describe("elo strategy", () => {
  it("returns empty for no results", () => {
    assert.deepStrictEqual(elo.compute([]), []);
  });

  // ... test your strategy logic
});
```

Run with:

```bash
npm run test:scoring
```

## Writing a Global Strategy

Global strategies combine per-challenge scores into a single leaderboard. They receive a `Record<string, ScoringEntry[]>` where keys are challenge types and values are the output of the first per-challenge strategy.

```typescript
import type { GlobalScoringStrategy, ScoringEntry } from "@arena/engine/scoring/types";

export const myGlobal: GlobalScoringStrategy = {
  name: "my-global",

  compute(perChallenge: Record<string, ScoringEntry[]>): ScoringEntry[] {
    // perChallenge is { "psi": [...], "gencrypto": [...] }
    // Combine them however you want and return ScoringEntry[]
    return [];
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
