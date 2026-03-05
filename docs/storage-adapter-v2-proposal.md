# Storage Adapter V2 Proposal (PRs #127, #128, #129)

## Decision

For the goal "support many DBs later, easy switch from in-memory to DB, keep security tight", the best base is **PR #128** with selected ideas from #129 and #127.

- Keep from **#128**: dialect-agnostic Kysely adapters, narrow scope (chat/users/scoring only), cleaner separation from challenge runtime.
- Keep from **#129**: `getScoresForPlayer`, explicit `STORAGE` selection, graceful DB shutdown.
- Keep from **#127**: shared storage bootstrap used by both `start.ts` and `auth/start.ts`.
- Do **not** adopt from #127: persisting live challenge operators/challenges right now (zombie risk and complexity).
- Do **not** adopt from #129: Postgres-specific Drizzle schema as the core abstraction (locks future dialects).

## Why This Choice

### #127 (Kysely + SQLite + arena/challenge persistence)
- Pros: full persistence, auth + non-auth wiring done in startup.
- Cons: over-scoped; challenge operator persistence creates restart semantics issues; bigger schema and more failure modes.

### #128 (Kysely + generic SQL for chat/users/scoring)
- Pros: closest to "many DBs later", smallest persistent surface, easiest to reason about.
- Cons: still needs better atomic chat append contract and stronger operational hardening.

### #129 (Drizzle + Postgres)
- Pros: strong Postgres implementation details, useful fixes on shutdown and scoring player query.
- Cons: not a good cross-database base; unresolved auth wiring gap.

## Proposed Architecture

Split storage into two explicit domains:

1. **Runtime state (always in-memory for now)**
- `ArenaStorageAdapter` (challenge instances + operators)
- Purpose: short-lived orchestration state only

2. **Durable state (pluggable DB or memory)**
- `ChallengeCatalogStorageAdapter` (challenge metadata + invites + joined identities, no serialized game state/operator)
- `ChatStorageAdapter`
- `UserStorageAdapter`
- `ScoringStorageAdapter`
- Optional: `GameArchiveStorageAdapter` (completed games only, no operators)

This keeps challenge lifecycle simple while still persisting what matters across restarts.  
Key boundary: challenge metadata is persisted, but live operator/game state is not.

## Adapter Contract Changes

### Chat: keep names, change behavior

Current split causes race-prone designs in SQL adapters. Keep `ChatStorageAdapter` name, but make `appendMessage` the atomic source of truth.

```ts
interface ChatStorageAdapter {
  // Keep for compatibility while migrating callers.
  getNextIndex(channel: string): Promise<number>;

  // If message.index is missing, adapter assigns it atomically.
  // Return the stored message with final index.
  appendMessage(channel: string, message: ChatMessage): Promise<ChatMessage>;

  getMessagesForChannel(
    channel: string,
    opts?: { fromIndex?: number; limit?: number }
  ): Promise<ChatMessage[]>;
  deleteChannel(channel: string): Promise<void>;
  clearRuntimeState(): Promise<void>;
}
```

### Scoring: first-class player lookup

Keep #129 improvement in core interface:

```ts
getScoresForPlayer(playerId: string): Promise<Record<string, Record<string, ScoringEntry>>>;
```

### Lifecycle

All SQL-backed adapters should optionally implement:

```ts
interface ClosableStorage {
  close?(): Promise<void>;
  healthCheck?(): Promise<void>;
}
```

Use one shared factory for both auth and non-auth startup paths.

## Simplified Schema (Durable State)

Prefer 8 core tables (plus 1 optional):

1. `users`
- `user_id PK`
- `username NULL`
- `model NULL`
- optional timestamps

2. `challenges`
- `challenge_id PK`
- `challenge_type`
- `created_at`
- `completed_at NULL`
- `status` (`pending` | `active` | `completed` | `expired`)
- no serialized game/operator state

3. `challenge_invites`
- `invite PK`
- `challenge_id FK -> challenges`
- `player_index`
- `user_id NULL` (set when joined)
- unique `(challenge_id, player_index)`

4. `chat_channel_counters`
- `channel PK`
- `next_index`

5. `chat_messages`
- `channel`
- `message_index`
- `from_id`
- `to_id NULL`
- `content`
- `timestamp`
- `type NULL`
- `redacted NOT NULL DEFAULT false`
- PK `(channel, message_index)`

6. `scoring_metrics`
- `scope` (`challenge` | `global`)
- `challenge_type NULL` (NULL when scope=global)
- `strategy_name`
- `player_id`
- `metric_key`
- `metric_value`
- PK `(scope, challenge_type, strategy_name, player_id, metric_key)`
- `games_played` stored as metric key (for example `games_played`)

7. `scoring_strategy_state`
- same key columns as `scoring_metrics` except `metric_key`
- `state_json`
- PK `(scope, challenge_type, strategy_name, player_id)`

8. `schema_migrations` (managed by migrator)

9. Optional `game_results` (recommended)
- completed game summary for user history/recompute
- no live operator state

This removes global-vs-local duplicate tables, avoids "phantom score entry from strategy state", and keeps challenge persistence independent from live game state.

## Security Baseline

1. Validate adapter inputs at boundary (length caps for ids/channel/content).
2. Keep all multi-statement writes in DB transactions.
3. Add limits/pagination on list/sync APIs (chat/challenges/users).
4. Use shared startup factory so auth mode cannot bypass DB wiring.
5. Do not log secrets/connection strings/full DB paths in production logs.
6. Add explicit protection for destructive clear operations in production.
7. Ensure DB shutdown hooks close pools/connections cleanly.
8. Document filesystem protections for SQLite (if used).

## Implementation Plan

1. **Contract refactor**
- Evolve existing `ChatStorageAdapter` (no rename): make `appendMessage` atomic and return final indexed message.
- Add `getScoresForPlayer` to scoring contract.

2. **Shared storage bootstrap**
- `api/storage/createStorage.ts` returns `{ engineOptions, close?, healthCheck? }`.
- Used by both `api/start.ts` and `api/auth/start.ts`.

3. **SQL core package**
- Keep SQL adapters in engine as dialect-agnostic Kysely.
- Move concrete DB clients/drivers to API layer.

4. **Schema + migrations**
- Implement simplified schema above.
- Add migration tests for up/down and data compatibility.
- Backward compatibility break is acceptable for this migration.

5. **Hardening + tests**
- Concurrency tests for chat append.
- Transaction rollback tests.
- Auth mode wiring test with SQL enabled.
- Pagination and bounds tests for high-cardinality tables.
