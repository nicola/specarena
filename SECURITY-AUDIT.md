# Security Audit Report — auth-hmac-pk (Follow-Up)

**Date:** 2026-02-22 (follow-up)
**Original audit:** 2026-02-22
**Scope:** `engine/auth.ts`, `engine/auth/middleware.ts`, `engine/engine.ts`, `engine/chat/ChatEngine.ts`, `engine/server/routes/*`, `engine/server/mcp/*`, `engine/server/index.ts`

---

## Executive Summary

The first audit identified 21 findings (5C/5H/7M/4L). Remediation addressed **14 of 21** original findings successfully. All five CRITICAL issues (unauthenticated endpoints, IDOR via `from` spoofing, legacy auth bypass) are confirmed FIXED. The follow-up audit discovered **12 NEW** findings and confirmed **7 REMAINS** from the original. A second round of fixes addressed all 4 HIGH findings: challenge creation rate limiting (N1), challenge listing sanitization (N2), MCP route separation (N3), and arena sync redaction (N4).

**Current totals:** 0 HIGH, 9 MEDIUM, 8 LOW, 2 INFO — 19 open findings (8 new, 7 remains, 2 deferred, 2 informational)

---

## Remediation Status — Original Findings

| Original ID | Title | Status |
|---|---|---|
| C1 | Unauthenticated `/api/chat/messages/:uuid` | **FIXED** — `sessionAuth` middleware applied |
| C2 | Unauthenticated SSE broadcasts DMs | **FIXED** — auth required, per-subscriber redaction |
| C3 | IDOR via `from` param spoofing on sync | **FIXED** — `from` fallback removed, identity from session |
| C4 | Chat sync bypasses redaction | **FIXED** — uses `syncChannelWithRedaction` |
| C5 | Legacy join bypasses Ed25519 | **FIXED** — auth params required, partial → 400 |
| H1 | Senders can't see own DMs | **FIXED** — added `msg.from !== authenticatedUser` check |
| H2 | SSE broadcasts raw DMs | **FIXED** — per-subscriber redaction in `notifyChannelSubscribers` |
| H3 | Double body read | **PARTIAL** — middleware stores `parsedBody`, but handlers don't consume it (see R1) |
| H4 | Error handler leaks internals | **FIXED** — returns generic "Internal server error" |
| H5 | Session keys no expiration | **REMAINS** (see R2) |
| M1 | `engine.secret` public | **FIXED** — `private readonly _secret` with wrapper methods |
| M2 | `userIndex` no bounds check | **FIXED** — `RangeError` for invalid indices |
| M3 | `challengeId` uses `\|\|` not `??` | **FIXED** — uses `??` (nullish coalescing) |
| M4 | No timestamp type validation | **FIXED** — REST validates `typeof timestamp !== "number"` |
| M5 | No `to` field validation | **REMAINS** (see R3) |
| M6 | Redacted messages leak metadata | **FIXED** — strips `from`, `to`, `timestamp` |
| M7 | Negative index accepted | **FIXED** — `Math.max(0, ...)` clamping |
| L1 | Session key in URL query param | **REMAINS**, upgraded to MEDIUM (see R4) |
| L2 | Distinct join error messages | **REMAINS** (see R5) |
| L3 | `verifySignature` swallows exceptions | **REMAINS** (see R6) |
| L4 | Single HMAC secret, no rotation | **REMAINS** (see R7) |

---

## REMAINING Findings

### R1 — MEDIUM | Handlers ignore `parsedBody` — double body consumption (was H3)
**Files:** `engine/auth/middleware.ts:47`, `engine/server/routes/arena.ts:67`, `engine/server/routes/chat.ts:14`
Middleware stores parsed body via `c.set("parsedBody", body)`, but all POST handlers still call `c.req.json()` independently. The fix is structurally present in middleware but no handler consumes the cached value.
**Fix:** Have handlers read from `c.get("parsedBody")` instead of `c.req.json()`.

### R2 — MEDIUM | Session keys have no expiration or revocation (was H5)
**Files:** `engine/auth.ts`, `engine/engine.ts`
Keys are deterministic HMAC values with no TTL. A leaked key is valid indefinitely for reads. No per-key revocation.
**Note:** Architectural; deferred.

### R3 — MEDIUM | No validation that `to` field references a valid participant (was M5)
**Files:** `engine/server/routes/chat.ts:20`, `engine/server/mcp/chat.ts`
`to` can be any arbitrary string. Enables phantom DMs, self-DMs, and data injection into stored messages.
**Fix:** Validate `to` is in `challenge.instance.state.players` or null/undefined.

### R4 — MEDIUM | Session key in URL query param leaks credentials (was L1, upgraded)
**File:** `engine/auth/middleware.ts:22`
`?key=` query param appears in server logs, browser history, CDN caches, and `Referer` headers. More impactful now that session keys are the sole post-join auth mechanism.
**Fix:** Remove `?key=` or use short-lived single-use SSE tickets.

### R5 — LOW | Distinct join error messages leak validation stage (was L2)
**File:** `engine/server/routes/arena.ts:13-58`
Different error messages at each stage help attackers enumerate validity. Return uniform "Invalid join request" for all client failures.

### R6 — LOW | `verifySignature` silently swallows all exceptions (was L3)
**File:** `engine/auth.ts:65-78`
All exceptions return `false`, including unexpected runtime errors. Log at debug level before returning.

### R7 — LOW | Single global HMAC secret with no rotation (was L4)
**File:** `engine/engine.ts:32`
`_secret` generated once, never rotated. Compromise means all keys (past/present/future) can be forged.

---

## NEW Findings

### ~~N1~~ — ~~HIGH~~ | FIXED | Challenge creation rate limited
**File:** `engine/server/routes/challenges.ts`
Added in-memory rate limiter (100 req/min per IP) to `POST /api/challenges/:name`. Production deployments should add reverse-proxy-level rate limiting as well.

### ~~N2~~ — ~~HIGH~~ | FIXED | Challenge listings sanitized
**File:** `engine/server/routes/challenges.ts`
`GET /api/challenges` and `GET /api/challenges/:name` now return sanitized objects (`id`, `name`, `createdAt`, `challengeType`, `players` count, `gameStarted`, `gameEnded`). Invite codes, public keys, and game instance state are stripped. Full challenge data (including invites) is only returned to the creator on `POST`.

### ~~N3~~ — ~~HIGH~~ | FIXED | MCP routes moved to `/api/mcp/*`
**File:** `engine/server/index.ts`
MCP transport endpoints moved from `/api/arena/{mcp,sse,message}` and `/api/chat/{mcp,sse,message}` to `/api/mcp/arena/{mcp,sse,message}` and `/api/mcp/chat/{mcp,sse,message}`. No more path collision with authenticated REST routes.

### ~~N4~~ — ~~HIGH~~ | FIXED | Arena sync now uses redaction
**File:** `engine/chat/ChatEngine.ts:142-144`
`challengeSync()` now delegates to `syncChannelWithRedaction()` instead of `syncChannel()`/`filterVisibleMessages()`. DMs to other players are shown as `[redacted]` placeholders (consistent with chat sync) rather than being silently dropped.

### N5 — MEDIUM | GET middleware passthrough allows unauthenticated access to handlers
**File:** `engine/auth/middleware.ts:24-29`
GET requests without a key proceed to handlers unauthenticated. Each handler must manually check `sessionUser` — if any future handler forgets, it's silently exposed.
**Fix:** Make middleware return 401 for all keyless requests, or split into `requireAuth` and `optionalAuth`.

### N6 — MEDIUM | SSE/messages routes: channel mismatch between path param and auth
**Files:** `engine/auth/middleware.ts:53`, `engine/server/routes/chat.ts:41,53`
Middleware extracts `challengeId` from `?channel=` query param for GET routes. But `/api/chat/ws/:uuid` and `/api/chat/messages/:uuid` use a `:uuid` path param. A user could authenticate against challenge A (via `?channel=challenge_A`) but access challenge B's stream (via `/api/chat/ws/challenge_B`).
**Fix:** Middleware should also extract `challengeId` from path params. Handlers should verify path param matches authenticated challenge.

### N7 — MEDIUM | REST `/api/arena/message` doesn't verify body `challengeId` matches session
**File:** `engine/server/routes/arena.ts:67`
Handler re-reads `challengeId` from body instead of using `sessionUser.challengeId`. If body parsing diverges from middleware parse, the handler could act on a different challenge than authenticated.
**Fix:** Use `sessionUser.challengeId` in handlers, or assert `body.challengeId === sessionUser.challengeId`.

### N8 — MEDIUM | Invite routes are fully unauthenticated
**File:** `engine/server/routes/invites.ts`
`GET /api/invites/:inviteId` discloses invite validity/usage status. `POST /api/invites` broadcasts invite ID to chat. If invite codes are leaked, these endpoints confirm validity without auth.
**Fix:** Add rate limiting. Consider whether invite broadcast needs to be public.

### N9 — MEDIUM | SSE subscriber without `user` receives unredacted messages
**File:** `engine/chat/ChatEngine.ts:86`
When `entry.user` is falsy, message is sent unredacted. Currently all SSE subscribers pass a user, but the optional parameter is a latent vulnerability.
**Fix:** Make `user` required in `subscribeToChannel()`.

### N10 — MEDIUM | Error handler heuristic may mask 500 errors as 400
**File:** `engine/server/index.ts:40-46`
`err.message.includes("JSON")` is overly broad. Any internal error containing "JSON" gets surfaced as 400 instead of 500.
**Fix:** Narrow to `err instanceof SyntaxError` only. Remove `includes("JSON")` heuristic.

### N11 — LOW | No replay protection for signed join requests
**File:** `engine/auth.ts:111-127`
Valid signed requests can be replayed within the 5-minute timestamp window. Invite dedup prevents duplicate joins, but TOCTOU edge cases exist.
**Fix:** Track used `(publicKey, timestamp)` tuples in a short-lived cache.

### N12 — LOW | `challengeMessage` sends to chat before verifying challenge exists
**File:** `engine/engine.ts:191-194`
Chat message emitted before `if (!challenge)` check. TOCTOU concern if challenge is deleted between auth and processing.
**Fix:** Move chat send after the existence check.

### N13 — LOW | v1 path rewrite creates unfiltered route duplication
**File:** `engine/server/index.ts:49-53`
`/api/v1/*` rewrites to `/api/*`. Both paths are functional, but WAF/rate-limit rules on `/api/` may not cover `/api/v1/`.
**Fix:** Ensure external rules cover both prefixes.

### N14 — LOW | Public unredacted message accessors on ChatEngine
**File:** `engine/chat/ChatEngine.ts:27,31`
`getMessagesForChannel()` and `getMessagesForChallengeChannel()` are public and return raw messages. If called from a future route, they bypass all redaction.
**Fix:** Make private or rename to `*Unredacted`.

### N15 — LOW | No input length limits on message content
**Files:** `engine/server/routes/chat.ts`, `engine/server/mcp/chat.ts`
No max length on `content` field. Arbitrarily large messages consume in-memory storage.
**Fix:** Add `z.string().max(10000)` in MCP and equivalent check in REST.

### N16 — LOW | `clearRuntimeState` does not regenerate HMAC secret
**File:** `engine/engine.ts:45-49`
Old session keys from cleared challenges would technically still validate if same `challengeId` is reused (UUID collision extremely unlikely).
**Fix:** Regenerate `_secret` in `clearRuntimeState()`.

---

## INFO

### I1 — Channel-to-challengeId derivation accepts dual formats
`channel` param accepts both `"challenge_<id>"` and `"<id>"`. Not exploitable due to HMAC validation, but increases surface for logic bugs.

### I2 — `userIndex` single-digit encoding caps players at 10
Session key format encodes userIndex as one character. Hard limit of 10 players per challenge. Acceptable if intentional.

---

## Positive Findings

- Timing-safe HMAC comparison correctly implemented
- Ed25519 uses Node.js native crypto (RFC 8032, no malleability)
- HMAC key generation uses 256-bit CSPRNG entropy
- `from` identity derived server-side on authenticated paths (prevents impersonation)
- All five original CRITICAL issues fully remediated
- Per-subscriber SSE redaction working correctly
- Redacted messages properly strip metadata
- Session auth consistently applied across REST and MCP for core operations
- Test suite covers 107 tests including security-specific red team scenarios
- All 4 HIGH findings from follow-up audit fixed and verified
