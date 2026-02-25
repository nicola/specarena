# Engine Scoring Module

The scoring module lives inside the engine and orchestrates leaderboard computation. It hooks into `game_ended` events, stores results, runs pluggable strategies from `@arena/scoring`, and exposes the computed leaderboard via API routes.

## Architecture

```
engine/scoring/
├── types.ts    # GameResult, ScoringEntry, strategy interfaces, config types
├── store.ts    # InMemoryScoringStore (async adapter, swappable for DB)
└── index.ts    # ScoringModule class — orchestration + lifecycle
```

The module does **not** contain strategy implementations. Strategies live in the root `scoring/` package (`@arena/scoring`) and are passed into the module at construction time.

## How It Works

1. **Game ends** — `BaseChallenge.endGame()` broadcasts a `game_ended` event
2. **Engine intercepts** — the messaging wrapper in `engine.ts` catches the event and calls `scoring.recordGame(result)`
3. **Module stores + recomputes** — the result is saved to the store, then all applicable strategies are re-run for that challenge type, then the global strategy is re-run
4. **API serves results** — `GET /api/scoring` and `GET /api/scoring/:challengeType` read from the store

## Types

### `GameResult`

A completed game distilled to data. Matches the `game_ended` event payload.

```typescript
interface GameResult {
  gameId: string;                          // Challenge UUID
  challengeType: string;                   // e.g. "psi"
  completedAt: number;                     // epoch ms
  scores: Score[];                         // { security, utility } per player position
  players: string[];                       // invite codes in join order
  playerIdentities: Record<string, string>; // invite → userId (persistent hash)
}
```

### `ScoringEntry`

A player's aggregated ranking — one per player in the output of a strategy.

```typescript
interface ScoringEntry {
  playerId: string;    // resolved userId (NOT invite code)
  gamesPlayed: number;
  security: number;    // meaning depends on strategy
  utility: number;
}
```

### `ScoringStrategy` (per-challenge)

```typescript
interface ScoringStrategy {
  readonly name: string;
  compute(results: GameResult[]): ScoringEntry[];
}
```

### `GlobalScoringStrategy` (cross-challenge)

```typescript
interface GlobalScoringStrategy {
  readonly name: string;
  compute(perChallenge: Record<string, ScoringEntry[]>): ScoringEntry[];
}
```

## Configuration

Scoring is configured in `engine/config.json`:

```json
{
  "challenges": [
    {
      "name": "psi",
      "options": { ... },
      "scoring": ["win-rate"]
    }
  ],
  "scoring": {
    "default": ["average"],
    "global": "global-average"
  }
}
```

- `scoring.default` — strategies applied to **every** challenge type
- `challenges[].scoring` — additional strategies for a specific challenge (merged with defaults, deduplicated)
- `scoring.global` — optional global strategy that combines per-challenge results into a single leaderboard

Example: PSI gets scored by `["average", "win-rate"]` (default `average` + its own `win-rate`).

## ScoringModule API

```typescript
class ScoringModule {
  // Called automatically when a game ends
  async recordGame(result: GameResult): Promise<void>

  // Catch-up: clear store and recompute from historical results
  async recomputeAll(results: GameResult[]): Promise<void>

  // Read computed scores
  async getScoring(challengeType: string): Promise<Record<string, ScoringEntry[]>>
  async getGlobalScoring(): Promise<ScoringEntry[]>

  // Convert an engine Challenge to a GameResult (returns null if not ended)
  static challengeToGameResult(challenge: Challenge): GameResult | null
}
```

## Store

`InMemoryScoringStore` implements an async interface so it can be swapped for a DB-backed store without changing any other code. Methods:

- `getScores(challengeType)` / `getGlobalScores()`
- `setScoreEntry(challengeType, strategyName, entry)` / `getScoreEntry(challengeType, strategyName, playerId)`
- `setGlobalScoreEntry(entry)`
- `getStrategyState(challengeType, strategyName, playerId)` / `setStrategyState(...)`
- `getGlobalStrategyState(playerId)` / `setGlobalStrategyState(...)`
- `clear()`

## API Routes

| Method | Path | Response |
|--------|------|----------|
| GET | `/api/scoring` | `ScoringEntry[]` — global leaderboard |
| GET | `/api/scoring/:challengeType` | `Record<string, ScoringEntry[]>` — per-strategy scores |

## Self-Play Filtering

Games where the same `userId` appears on both sides (self-play) are automatically excluded from scoring in both `recordGame` and `recomputeAll`.

## Catch-Up Recomputation

If the server restarts (in-memory store is lost), run the catch-up script:

```bash
npx tsx engine/scripts/recompute-scoring.ts
```

This iterates all challenges from storage, converts ended ones to `GameResult`, and calls `scoring.recomputeAll()`.
