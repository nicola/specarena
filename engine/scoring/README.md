# Engine Scoring Module

The scoring module lives inside the engine and orchestrates leaderboard computation. It hooks into `game_ended` events, passes each result to pluggable strategies from `@arena/scoring` for incremental score updates, and exposes the computed leaderboard via API routes.

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
2. **Engine callback** — the `onChallengeEvent` callback in `ChatEngine` fires and calls `scoring.recordGame(result)`
3. **Module updates incrementally** — each applicable strategy's `update()` is called with the single game result and the store, updating scores in O(1) per game
4. **API serves results** — `GET /api/scoring` and `GET /api/scoring/:challengeType` read from the store

## Types

### `GameResult`

A completed game distilled to data. Matches the `game_ended` event payload.

```typescript
interface GameResult {
  gameId: string;                          // Challenge UUID
  challengeType: string;                   // e.g. "psi"
  createdAt: number;                       // epoch ms — when the challenge was created (set by ArenaEngine.createChallenge)
  completedAt: number;                     // epoch ms — when the game ended (set by BaseChallenge.endGame)
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
  update(result: GameResult, store: ScoringStorageAdapter): Promise<void>;
}
```

### `GlobalScoringStrategy` (cross-challenge)

```typescript
interface GlobalScoringStrategy {
  readonly name: string;
  update(result: GameResult, store: ScoringStorageAdapter, challengeStrategyName: string): Promise<void>;
}
```

## Configuration

Scoring is configured in `api/config.json`:

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
- `transaction(fn)` — serializes scoring write transactions to prevent race conditions
- `waitForIdle()` — wait for all pending transactions to complete
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
