# PR #28 Audit: Scoring Module

**PR:** feat: add scoring module with pluggable strategies
**Branch:** `scoring` | **Files changed:** 28 | **+2027 / -78**
**Date:** 2026-02-25

---

## Critical

### 1. Race condition in concurrent `recordGame`

**`engine/engine.ts:42-52`**

`recordGame` is fire-and-forget (`.catch()` but not `await`-ed). Two games ending simultaneously for the same player can interleave: both read `count: 5`, both write `count: 6`, correct answer is `count: 7`. The in-memory store has no transactional guarantees.

```typescript
this.scoring.recordGame({ ... }).catch((err) => console.error(...));
```

**Fix:** Add a promise chain / simple mutex in `ScoringModule.recordGame`, or `await` it.

---

## Medium

### 2. `completedAt` uses challenge creation time

**`engine/scoring/index.ts:106`**

```typescript
completedAt: challenge.createdAt,  // BUG: should be completion time
```

In the real-time path (`engine.ts:48`) it correctly uses `Date.now()`, but the recompute path uses `createdAt`. Any future time-based strategy (decay, recency weighting) would silently break.

**Fix:** Store actual completion timestamp on the challenge, or use `Date.now()` in both paths.

### 3. Global strategy implicitly uses "first" per-challenge strategy

**`engine/scoring/index.ts:57-62`**

```typescript
const strategyNames = this.getStrategiesForChallenge(result.challengeType);
const firstStrategy = strategyNames[0]; // depends on array order
```

The global leaderboard reads whichever strategy happens to be first in `[...defaults, ...challengeSpecific]`. Reordering `config.scoring.default` silently changes global rankings.

**Fix:** Make this explicitly configurable (e.g., `scoring.globalSource: "average"`) or document the invariant.

### 4. Circular package dependency

**`scoring/average.ts`** imports types from `@arena/engine/scoring/types`.
**`engine/package.json`** depends on `@arena/scoring`.

This is a circular dependency (`engine -> scoring -> engine`). It works today because `@arena/scoring` only uses type imports (erased at runtime), but adding any runtime import will break it. Additionally, `scoring/package.json` declares no dependency on `@arena/engine` despite importing from it.

**Fix:** Extract shared types (`ScoringStrategy`, `GameResult`, `ScoringStorageAdapter`, `ScoringEntry`) into a `@arena/types` package, or have the scoring package own the interfaces.

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

### 6. Unvalidated `:challengeType` route parameter

**`engine/server/routes/scoring.ts:20`**

No validation that `challengeType` is a recognized value. Safe with `InMemoryScoringStore` (returns `{}`), but a DB adapter could be vulnerable.

**Fix:** Validate against registered challenge types, return 404 for unknown.

### 7. Composite key collision potential

**`engine/scoring/store.ts:49`**

```typescript
const key = `${challengeType}:${strategyName}`;
```

If either contains `:`, keys collide. Currently config-controlled so low risk.

### 8. Shared references in `challengeToGameResult`

**`engine/scoring/index.ts:103-111`**

`scores`, `players`, `playerIdentities` are shared with live challenge state. If any strategy mutates them, it corrupts the challenge.

**Fix:** Shallow-copy arrays/objects in the return.

### 9. Test timing is flaky

**`engine/test/scoring.test.ts:356, 405`**

```typescript
await new Promise((r) => setTimeout(r, 50));
```

Fire-and-forget scoring means tests use a 50ms sleep. Flaky on slow CI.

**Fix:** Expose a way to `await` scoring completion (resolves with fixing #1).

### 10. Error message leakage

**`engine/server/index.ts:77`**

```typescript
return c.json({ error: err.message }, 500);
```

Raw error messages returned to clients. Could leak internal details.

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

### 16. No auth on scoring endpoints

**`engine/server/routes/scoring.ts`** -- Both endpoints are unauthenticated. Likely intentional (public leaderboard), but should be documented as a design decision.

---

## Summary

| Severity | # | Top items |
|----------|---|-----------|
| **Critical** | 1 | Race condition in concurrent `recordGame` |
| **Medium** | 4 | `completedAt` bug, implicit global strategy ordering, circular dependency, `as any` type escape |
| **Low** | 5 | Unvalidated route param, key collision, shared refs, flaky tests, error leakage |
| **Informational** | 6 | Mutable field, no config validation, display truncation, hardcoded domain, dead script, no auth docs |

## Recommended Actions Before Merge

1. **Serialize `recordGame` calls** -- add a simple promise queue to prevent lost updates
2. **Validate event shape** at the `onChallengeEvent` boundary with a runtime guard
3. **Fix `completedAt`** in `challengeToGameResult`
4. **Make global strategy source explicit** in config

## Can Defer Post-Merge

5. Extract shared types to break circular dependency
6. Config validation at construction time
7. Auto-scaling graph domain
8. Replace test `setTimeout` with proper await mechanism (follows from #1)
