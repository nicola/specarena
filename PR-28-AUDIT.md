# PR #28 Audit: Scoring Module

**PR:** feat: add scoring module with pluggable strategies
**Branch:** `scoring` | **Files changed:** 28 | **+2027 / -78**
**Date:** 2026-02-25

---

## Critical

### 1. ~~Race condition in concurrent `recordGame`~~ FIXED

**`engine/engine.ts:42-52`**

Fixed in #85 and #86.

`recordGame` is still fire-and-forget from the event hook, but scoring updates are now serialized at the storage boundary (`ScoringStorageAdapter.transaction` + `InMemoryScoringStore` transaction queue), so concurrent completions no longer lose increments.

```typescript
this.scoring.recordGame({ ... }).catch((err) => console.error(...));
```

Also fixed the flaky timing dependency in tests by exposing `waitForIdle()` and replacing `setTimeout(50)` waits.

---

## Medium

### 2. ~~`completedAt` uses challenge creation time~~ FIXED

Fixed in #79 and #80. `completedAt` is now set by `BaseChallenge.endGame()` via `Date.now()`. `GameResult` has both `createdAt` (set by `ArenaEngine.createChallenge`) and `completedAt`. Fallback is `Date.now()` instead of `challenge.createdAt`.

### 3. ~~Global strategy implicitly uses "first" per-challenge strategy~~ FIXED

Fixed in #81. Added `scoring.globalSource` to config to explicitly declare which per-challenge strategy feeds global aggregation. Falls back to `scoring.default[0]`.

### 4. ~~Circular package dependency~~ FIXED

Fixed in #78. Scoring types, interfaces, and `InMemoryScoringStore` moved into `@arena/scoring`. Engine re-exports for backward compatibility. Dependency is now one-way: `engine -> scoring`.

### 5. `as any` type escape in scoring hook

**`engine/engine.ts:49`**

```typescript
scores: event.scores as any[],
players: event.players as string[],
playerIdentities: event.playerIdentities as Record<string, string>,
```

`event` is `Record<string, unknown>`. `as any` bypasses type safety -- malformed `game_ended` events silently corrupt incremental state (partial writes before strategies throw).

**Fix:** Add a runtime shape check (Zod schema or guard function) before passing into `recordGame`.

---

## Low

### 6. ~~Unvalidated `:challengeType` route parameter~~ FIXED

Fixed in #73. Returns 404 for unknown challenge types. Test added.

### 7. Composite key collision potential

**`scoring/store.ts:49`**

```typescript
const key = `${challengeType}:${strategyName}`;
```

If either contains `:`, keys collide. Currently config-controlled so low risk.

### 8. Shared references in `challengeToGameResult`

**`engine/scoring/index.ts:103-111`**

`scores`, `players`, `playerIdentities` are shared with live challenge state. If any strategy mutates them, it corrupts the challenge.

**Fix:** Shallow-copy arrays/objects in the return.

### 9. ~~Test timing is flaky~~ FIXED

**`engine/test/scoring.test.ts:356, 405`**

```typescript
await new Promise((r) => setTimeout(r, 50));
```

Fixed in #85. Scoring tests now call `waitForIdle()` instead of sleeping.

### 10. ~~Error message leakage~~ FIXED

Fixed in #70. Global error handler now returns `"Internal server error"` instead of raw `err.message`.

---

## Informational

### 11. `scoring` is a mutable public property

**`engine/engine.ts:26`** -- `scoring: ScoringModule | null` is public and mutated externally in `server/index.ts:56`. Should be `private` or constructor-only.

### 12. `ScoringModule` does not validate config at construction

Strategy names referenced in config are not checked against registered strategies. Unknown names are silently skipped (`if (!strategy) continue`). Misconfiguration is invisible.

### 13. Leaderboard truncates playerId to 8 chars

**`leaderboard/src/app/page.tsx:21`** -- `entry.playerId.slice(0, 8)`. Birthday paradox: collisions likely around ~65k players (32 bits of entropy from 8 hex chars).

### 14. Graph domain hardcoded to [-2, 2]

**`leaderboard/src/app/components/LeaderboardGraph.tsx:156-162`** -- Scores outside this range are clipped/invisible. Should auto-scale or match strategy value ranges.

### 15. Recompute script persists nothing

**`engine/scripts/recompute-scoring.ts`** creates a fresh `InMemoryScoringStore`, computes scores, prints them, and exits. Results are lost. Only useful once a persistent storage adapter exists.

### 16. No auth on scoring endpoints -- INTENTIONAL

**`engine/server/routes/scoring.ts`** -- Both endpoints are unauthenticated. This is intentional: the leaderboard is public data.

---

## Summary

| # | Issue | Severity | Status |
|---|-------|----------|--------|
| 1 | Race condition in `recordGame` | Critical | **Fixed** #85 #86 |
| 2 | `completedAt` uses creation time | Medium | **Fixed** #79 #80 |
| 3 | Implicit global strategy ordering | Medium | **Fixed** #81 |
| 4 | Circular package dependency | Medium | **Fixed** #78 |
| 5 | `as any` type escape in scoring hook | Medium | Open |
| 6 | Unvalidated `:challengeType` param | Low | **Fixed** #73 |
| 7 | Composite key collision | Low | Open |
| 8 | Shared references in `challengeToGameResult` | Low | Open |
| 9 | Flaky test timing | Low | **Fixed** #85 |
| 10 | Error message leakage | Low | **Fixed** #70 |
| 11 | Mutable public `scoring` field | Informational | Open |
| 12 | No config validation at construction | Informational | Open |
| 13 | playerId truncated to 8 chars | Informational | Open |
| 14 | Hardcoded graph domain | Informational | Open |
| 15 | Recompute script persists nothing | Informational | Open |
| 16 | No auth on scoring endpoints | Informational | **Intentional** |
