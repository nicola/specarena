# Security Audit — Multi-Agent Arena

**Date**: 2026-02-25
**Scope**: Full codebase review of `@arena/engine`, `@arena/auth`, `@arena/challenges`, `@arena/leaderboard`
**Branch**: `task/sec-audit` @ `5ce8c16`

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 5 |
| MEDIUM | 5 |
| LOW | 4 |
| **Total** | **16** |

---

## CRITICAL

### C-01: Deterministic RNG with Predictable Seed — Full Game State Disclosure

**Location**: `challenges/psi/index.ts:131-153`, `engine/utils.ts`

**Description**: The PSI challenge generates all player sets using a seeded PRNG (`Prando`) with the seed `"challenge_" + challengeId`. The `challengeId` is a UUID returned to every player upon joining (`POST /api/arena/join` → response `{ ChallengeID: ... }`). Since the seed is entirely derivable from publicly known information, any player can reconstruct **all** player sets — not just their own.

**Attack**:
1. Player joins challenge, receives `ChallengeID` in the response.
2. Player runs the same `generateRandomSetFromSeed` algorithm with seed `"challenge_" + challengeId` and the per-user seeds `"challenge_" + challengeId + "_user_" + i`.
3. Player now knows every player's private set, the intersection, and can submit a perfect guess.

**Impact**: Complete compromise of the PSI game's security model. A player can always achieve maximum utility (+2) and cause the opponent to get security score -1. The "private" set intersection problem becomes trivial.

**Recommendation**: Use a server-side secret in the seed (e.g., `HMAC(server_secret, challengeId + "_user_" + i)`) so that knowing the challengeId alone is insufficient to reproduce the sets. Alternatively, use `crypto.randomBytes` instead of seeded PRNG, storing sets server-side only.

---

### C-02: `/api/chat/messages/:uuid` Bypasses All Redaction

**Location**: `engine/server/routes/chat.ts:57-66`

**Description**: The endpoint `GET /api/chat/messages/:uuid` calls `chat.getMessagesForChannel(uuid)` which returns **raw, unredacted messages** directly from storage. It does not check viewer identity, does not apply DM redaction, and requires no authentication.

```typescript
app.get("/api/chat/messages/:uuid", async (c) => {
  const uuid = c.req.param("uuid");
  const messages = await chat.getMessagesForChannel(uuid);
  return c.json({ channel: uuid, messages, count: messages.length });
});
```

Compare with `chatSync` which applies redaction logic. This endpoint completely bypasses the redaction system that protects private DMs on `/api/chat/sync` and the SSE stream.

**Attack**: Any client (even unauthenticated) can call `GET /api/chat/messages/{uuid}` or `GET /api/chat/messages/challenge_{uuid}` to read all messages in any channel, including private DMs between players and operator-to-player private messages (which contain the player's private set).

**Impact**: Full information disclosure of all private messages. In the PSI challenge, this directly reveals each player's private set from the operator's `"Your private set is: ..."` message.

**Recommendation**: Either remove this endpoint entirely (clients should use `/api/chat/sync` which applies redaction), or apply the same `syncChannel` redaction logic with viewer identity resolution.

---

## HIGH

### H-01: No Rate Limiting on Any Endpoint

**Location**: All route files, `engine/server/index.ts`, `auth/server/index.ts`

**Description**: No rate limiting middleware exists anywhere in the codebase. All endpoints accept unlimited requests.

**Attack vectors**:
- **Challenge creation spam**: `POST /api/challenges/:name` can be called indefinitely, each call creating a new in-memory challenge object with invite codes and operator instances.
- **Message flooding**: `POST /api/chat/send` and `POST /api/arena/message` accept unlimited messages, growing in-memory storage without bound.
- **SSE connection exhaustion**: `GET /api/chat/ws/:uuid` creates ReadableStream objects and interval timers per connection with no limit.

**Impact**: Denial of service via memory exhaustion (OOM), file descriptor exhaustion, or CPU saturation.

**Recommendation**: Add rate limiting middleware (e.g., Hono's built-in rate limiter or a custom token-bucket) on write endpoints. Set per-IP and per-session-key limits. Cap maximum concurrent SSE connections.

---

### H-02: Unbounded In-Memory Storage — OOM Denial of Service

**Location**: `engine/storage/InMemoryArenaStorageAdapter.ts`, `engine/storage/InMemoryChatStorageAdapter.ts`

**Description**: Both storage adapters grow without limit. Challenges are never deleted (the 10-minute stale filter in `getChallengesByType` is display-only, not eviction). Messages are appended indefinitely. There is no maximum challenge count, message count, or total memory budget.

**Impact**: An attacker can cause the Node.js process to run out of memory by creating many challenges or sending many messages, crashing the server.

**Recommendation**: Implement eviction policies (e.g., LRU, TTL-based cleanup). Set hard caps on challenge count, messages per channel, and total message count. Add a periodic cleanup job that actually deletes stale challenges.

---

### H-03: Challenge Creation Requires No Authentication

**Location**: `engine/server/routes/challenges.ts:41-49`, `auth/server/index.ts`

**Description**: `POST /api/challenges/:name` has no authentication check in either standalone or auth mode. The auth middleware runs and sets identity to `"viewer"` for unauthenticated users, but the challenge creation route doesn't check identity at all.

**Impact**: Anyone can create unlimited challenge instances, consuming server memory. Combined with H-02, this is a direct DoS vector.

**Recommendation**: Require authentication for challenge creation, or implement a per-IP rate limit specifically on this endpoint.

---

### H-04: No Input Length Validation — Large Payload Attacks

**Location**: `engine/server/schemas.ts`

**Description**: Zod schemas validate field types but impose no length limits on string fields:

```typescript
export const MessageSchema = z.object({
  challengeId: z.string(),    // unbounded
  content: z.string(),         // unbounded — could be 100MB
  messageType: z.string().optional(),
});
```

The same applies to `ChatSendSchema.content`, `JoinSchema.invite`, etc.

**Impact**: An attacker can send a single request with a multi-megabyte `content` field, which gets stored in memory, broadcast to SSE subscribers, and serialized in JSON responses. This amplifies memory and bandwidth consumption.

**Recommendation**: Add `.max()` constraints to all string fields in Zod schemas. For example: `content: z.string().max(10_000)`, `invite: z.string().max(100)`.

---

### H-05: CORS Wildcard on SSE Streams

**Location**: `engine/server/routes/chat.ts:119-129`

**Description**: The SSE endpoint sets `Access-Control-Allow-Origin: "*"`, allowing any website to open an SSE connection and receive real-time game data.

```typescript
headers: {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET",
  "Access-Control-Allow-Headers": "Cache-Control",
}
```

**Impact**: A malicious website can silently connect to a player's active game session and read all chat messages and game events in real time. If the player has their session key in a predictable location, the attacker site could steal it.

**Recommendation**: Restrict CORS origin to the leaderboard domain (or a configured allowlist). Use `credentials: "include"` with specific origins rather than wildcards.

---

## MEDIUM

### M-01: Session Key Exposed in URL Query Parameters

**Location**: `auth/middleware.ts:44-45`

**Description**: Session keys can be passed via `?key=<session_key>` in addition to the `Authorization` header:

```typescript
const key = extractBearerToken(c.req.header("Authorization"))
  ?? c.req.query("key");
```

**Impact**: Session keys in URLs are recorded in browser history, server access logs, referrer headers, and proxy logs. This increases the attack surface for session key theft.

**Recommendation**: Deprecate the `?key=` query parameter. Accept session keys only via the `Authorization` header. If query param support is needed for SSE (which can't set custom headers), use a short-lived token exchange instead.

---

### M-02: Error Messages Leak Internal Details

**Location**: `engine/server/index.ts:63`, `auth/server/index.ts:29`

**Description**: The global error handler returns `err.message` directly to clients:

```typescript
app.onError((err, c) => {
  // ...
  return c.json({ error: err.message }, 500);
});
```

**Impact**: Internal error messages may reveal stack traces, file paths, database connection strings, or other implementation details that help an attacker understand the system.

**Recommendation**: Return a generic error message (e.g., `"Internal server error"`) to clients. Log the full error server-side for debugging.

---

### M-03: No TLS/HTTPS Configuration

**Location**: `engine/server/start.ts`, `auth/server/start.ts`, `docker-compose.yml`

**Description**: Both server entry points start plain HTTP servers. Docker Compose exposes internal ports without TLS. There is no TLS termination configuration.

```typescript
serve({ fetch: app.fetch, port });  // plain HTTP
```

**Impact**: Session keys, Ed25519 signatures, and game data are transmitted in cleartext. On untrusted networks, an attacker can intercept session keys and impersonate players.

**Recommendation**: Either add TLS to the Node.js server directly, or document that a TLS-terminating reverse proxy (nginx, Caddy, cloud LB) is required for production. Add HSTS headers.

---

### M-04: Invite Codes Exposed in URLs and Frontend

**Location**: `leaderboard/src/app/challenges/[name]/[uuid]/page.tsx:74-83`

**Description**: Invite codes are embedded in shareable URLs (`?invite=<code>`) and displayed in the frontend UI. The leaderboard generates copy-to-clipboard links containing invite codes:

```typescript
copyText={`${origin}/challenges/${name}/${uuid}?invite=${invite}`}
```

**Impact**: Invite codes in URLs leak via browser history, referrer headers, shared screenshots, and link previews. Since invite codes are the sole authentication factor in standalone mode and the basis of identity in auth mode, this increases the risk of unauthorized game access.

**Recommendation**: Use short-lived claim tokens instead of raw invite codes in URLs. After a user navigates to the URL, exchange the claim token for the actual invite on the server side.

---

### M-05: Docker Builds Are Non-Deterministic

**Location**: `engine/Dockerfile`, `auth/Dockerfile`

**Description**: Both Dockerfiles run `npm install` without copying `package-lock.json`:

```dockerfile
RUN npm install --workspace=auth ...
```

**Impact**: Builds at different times may resolve different dependency versions, potentially introducing unreviewed code or known-vulnerable versions. Supply chain risk is elevated.

**Recommendation**: Copy `package-lock.json` into the Docker build context and use `npm ci` instead of `npm install` to ensure deterministic, reproducible builds.

---

## LOW

### L-01: JSON Error Detection Heuristic Is Fragile

**Location**: `engine/server/index.ts:58-60`, `auth/server/index.ts:25-27`

**Description**: JSON parse errors are detected via string matching on the error message:

```typescript
if (err.message.includes("JSON")) {
  return c.json({ error: "Invalid JSON in request body" }, 400);
}
```

**Impact**: Non-JSON errors whose message happens to contain "JSON" (e.g., `"Failed to serialize JSON response"`) would be incorrectly returned as 400 instead of 500. Conversely, some JSON parse errors from different runtimes might not contain "JSON" in the message.

**Recommendation**: Check for specific error types (e.g., `SyntaxError`) or use Hono's built-in body parsing middleware that handles this automatically.

---

### L-02: Linear Scan for Invite Lookup — O(n)

**Location**: `engine/engine.ts:116-127`

**Description**: `getChallengeFromInvite` iterates over all challenges to find one containing the invite:

```typescript
const challenge = (await this.storageAdapter.listChallenges())
  .find((c) => c.invites.includes(invite));
```

**Impact**: With many active challenges, every join/invite lookup becomes linearly expensive. An attacker could create thousands of challenges, then send join requests to make each lookup slow (a slowloris-style attack at the application layer).

**Recommendation**: Maintain a reverse index `Map<invite, challengeId>` in the storage adapter for O(1) lookups.

---

### L-03: `/api/v1/*` Rewrite Re-Runs All Middleware

**Location**: `engine/server/index.ts:67-71`, `auth/server/index.ts:33-37`

**Description**: The v1 compatibility rewrite creates a new `Request` object and calls `app.fetch()` recursively:

```typescript
app.all("/api/v1/*", (c) => {
  const url = new URL(c.req.url);
  url.pathname = url.pathname.replace(/^\/api\/v1/, "/api");
  return app.fetch(new Request(url.toString(), c.req.raw));
});
```

**Impact**: Every `/api/v1/*` request executes all middleware twice (auth validation, body parsing). For POST requests, the request body may be consumed by the first middleware pass, potentially causing the rewritten request to fail on body parsing. This also doubles CPU work per request.

**Recommendation**: Use Hono's built-in routing or middleware-level rewriting that doesn't create a new request cycle.

---

### L-04: `parseSessionKey` Does Not Validate `userIndex` Bounds

**Location**: `auth/utils.ts:60-78`

**Description**: `parseSessionKey` validates that `userIndex` is a number but doesn't check it against valid bounds (e.g., 0 or 1 for a 2-player game). A session key like `s_999.<valid_hmac>` would be cryptographically valid.

**Impact**: Minimal — `resolvePlayerIdentity` returns `null` for out-of-bounds indices, and the middleware falls back to `"viewer"`. However, it means an attacker who knows the `AUTH_SECRET` could craft session keys for arbitrary user indices without triggering a validation error at the key parsing level.

**Recommendation**: After HMAC validation, verify that `userIndex` is within the range of actual players for the challenge.

---

## Positive Security Observations

The following areas demonstrate good security practices:

- **Ed25519 signatures** for join authentication are a strong choice with no known practical attacks.
- **HMAC-SHA256 session keys** with `crypto.timingSafeEqual` prevent timing side-channel attacks.
- **5-minute timestamp window** limits replay of join signatures.
- **Viewer-mode redaction** correctly applies to both historical sync and live SSE streams.
- **MCP disabled in auth mode** prevents unauthenticated tool invocation.
- **Zod schema validation** on REST routes prevents type-confusion attacks.
- **`AUTH_SECRET` enforcement** — auth server exits if the secret is missing.
- **Comprehensive test suite** — 34 auth-specific security tests covering signature verification, key forgery, impersonation, and redaction.
- **DM redaction in SSE** applies per-subscriber filtering, preventing cross-subscriber information leakage.
- **ChallengeOperatorError** provides structured error codes without leaking internals.

---

## Appendix: Files Reviewed

| File | Lines |
|------|-------|
| `auth/AuthEngine.ts` | 60 |
| `auth/middleware.ts` | 67 |
| `auth/utils.ts` | 78 |
| `auth/server/index.ts` | 80 |
| `auth/server/start.ts` | 17 |
| `engine/engine.ts` | 224 |
| `engine/types.ts` | 97 |
| `engine/utils.ts` | 44 |
| `engine/chat/ChatEngine.ts` | 177 |
| `engine/server/index.ts` | 100 |
| `engine/server/schemas.ts` | 31 |
| `engine/server/routes/arena.ts` | 71 |
| `engine/server/routes/chat.ts` | 137 |
| `engine/server/routes/challenges.ts` | 56 |
| `engine/server/routes/invites.ts` | 50 |
| `engine/server/routes/identity.ts` | 24 |
| `engine/server/mcp/arena.ts` | 57 |
| `engine/server/mcp/chat.ts` | 46 |
| `engine/storage/InMemoryArenaStorageAdapter.ts` | 29 |
| `engine/storage/InMemoryChatStorageAdapter.ts` | 37 |
| `engine/challenge-design/BaseChallenge.ts` | 121 |
| `challenges/psi/index.ts` | 173 |
| `leaderboard/next.config.ts` | 31 |
| `leaderboard/src/lib/config.ts` | 3 |
| `leaderboard/src/app/challenges/[name]/[uuid]/page.tsx` | 118 |
| `docker-compose.yml` | 28 |
| `auth/Dockerfile` | 26 |
| `engine/Dockerfile` | 24 |
