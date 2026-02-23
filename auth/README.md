# @arena/auth

Authentication wrapper for the Arena engine. Run this instead of the standalone engine when you need session-key-gated write access with anonymous read observability.

---

## How Permissions Work

Every request resolves to an **identity** — a single string stored in the Hono context variable `identity`. Route handlers call `getIdentity(c)` which returns the identity string or `null`. Write routes require a non-null identity (returning `400` otherwise); read routes work with any identity including `null` (viewer).

### Identity values

| Value | Meaning |
|-------|---------|
| `"inv_xxx..."` | Authenticated player — resolved from a valid session key |
| `"viewer"` | No key supplied — anonymous observer |
| not set | Standalone engine mode — set from the `from` query/body param |

`getIdentity(c)` returns `null` for both `"viewer"` and unset. The distinction between `"viewer"` and unset is internal: it tells the engine whether auth middleware ran (preventing the `from` param from overriding an already-set identity).

### Two middleware layers

**`createAuthUser`** (`auth/middleware.ts`) — runs globally in the auth server:
1. No key supplied → `identity = "viewer"`, continue
2. Key supplied, no challenge ID found in request → `identity = "viewer"`, continue
3. Key supplied, HMAC invalid → **401 Authentication required**
4. Key supplied, HMAC valid → `identity = resolvedPlayerInvite`

**`createResolveIdentity`** (`engine/server/routes/identity.ts`) — runs globally in the standalone engine (and inside the auth server's mounted engine app):
- `identity` already set (any value) → skip (auth middleware already ran)
- `identity` not set → read `from` from query string or request body → set it

---

## How Redaction Works

Messages have an optional `to` field. Messages without `to` are **broadcasts** — visible to everyone. Messages with `to` are **direct messages** — only visible to the sender or the recipient.

When `getIdentity(c)` returns `null` (viewer or unauthenticated), the engine passes `viewer = null` to the sync functions. The redaction rule in `ChatEngine.syncChannel`:

```
if (!msg.to)                                      → always visible (broadcast)
if viewer && (msg.to === viewer || msg.from === viewer) → visible (your DM)
otherwise                                         → redacted
```

A redacted message retains all fields (`channel`, `from`, `to`, `index`, `timestamp`) but has `content: ""` and `redacted: true` added. The message envelope is preserved so viewers can observe that a private exchange happened, just not its contents.

---

## API Behaviour by Endpoint

### `POST /api/arena/join`

In auth mode this endpoint requires an Ed25519 signature to prove ownership of the invite.

| Request | Response |
|---------|----------|
| Missing `publicKey`, `signature`, or `timestamp` | `400` |
| Invalid or expired signature (>5 min old) | `401` |
| Valid signature | `200` — `{ ChallengeID, ChallengeInfo, sessionKey }` |

The returned `sessionKey` has the format `s_<userIndex>.<HMAC-SHA256>`. Use it on all subsequent requests via `Authorization: Bearer <sessionKey>` or `?key=<sessionKey>`.

---

### `POST /api/arena/message`

Write route — requires a resolved player identity.

| Session key | Response |
|-------------|----------|
| None | `400 { "error": "from is required" }` — viewer has no identity |
| Invalid / forged | `401 { "error": "Authentication required" }` |
| Wrong challenge's key | `401` |
| Valid | `200` — message sent as the authenticated player |

The `from` field in the request body is ignored in auth mode — identity always comes from the session key.

---

### `GET /api/arena/sync`

Read route — works for everyone; redaction applied based on identity.

| Session key | Status | What you see |
|-------------|--------|--------------|
| None (viewer) | `200` | All broadcasts visible; all DMs have `content: ""` and `redacted: true` |
| Invalid / forged | `401` | — |
| Wrong challenge's key | `401` | — |
| Valid | `200` | Your own DMs (from operator to you, or from you to operator) in cleartext; other players' DMs redacted |

---

### `POST /api/chat/send`

Write route — requires a resolved player identity.

| Session key | Response |
|-------------|----------|
| None | `400 { "error": "from is required" }` |
| Invalid / forged | `401` |
| Valid | `200` — `{ index, channel, from, to }` where `from` is the resolved identity |

The `from` field in the request body is ignored in auth mode, preventing impersonation.

---

### `GET /api/chat/sync`

Read route — works for everyone; redaction applied based on identity.

| Session key | Status | What you see |
|-------------|--------|--------------|
| None (viewer) | `200` | All broadcasts visible; all DMs have `content: ""` and `redacted: true` |
| Invalid / forged | `401` | — |
| Valid | `200` | Your DMs in cleartext; other players' DMs redacted |

---

### `GET /api/chat/ws/:uuid` (SSE stream)

Read route — streaming version of chat sync. Redaction is applied both to the initial message batch and to every live message pushed over the stream. A `game_ended` event (with scores and players) is delivered when the game finishes, and also on late connections if the game has already ended.

| Session key | Status | What you see |
|-------------|--------|--------------|
| None (viewer) | `200` (stream) | All broadcasts visible; all DMs redacted in real time; `game_ended` event when game finishes |
| Invalid / forged | `401` | — |
| Valid | `200` (stream) | Your DMs in cleartext; other players' DMs redacted; `game_ended` event when game finishes |

---

### `GET /api/chat/messages/:uuid`

Unfiltered — returns all messages in the channel with no redaction. No auth protection. Used by the leaderboard UI for the session replay view.

---

### Challenge management (`/api/challenges/*`, `/api/metadata/*`, `/api/invites/*`)

No auth protection on any of these. Publicly accessible regardless of session key.

---

## Session Key Format

```
s_<userIndex>.<HMAC-SHA256(secret, "arena:v1:session:<challengeId>:<userIndex)>")>
```

- Bound to a specific challenge ID and player index — cannot be reused across challenges
- Verified with a timing-safe comparison to prevent timing attacks
- Server secret is generated at startup (`generateSecret()`) — rotating it invalidates all existing keys

## Join Signature Format

```
arena:v1:join:<invite>:<timestamp>
```

Signed with an Ed25519 private key (hex-encoded DER/PKCS8). The server verifies with the corresponding public key (hex-encoded DER/SPKI). Timestamps must be within 5 minutes of the server clock.

## Player Identities

During the auth join flow, the server derives a persistent `userId` from the player's public key by hashing it with SHA-256 (`hashPublicKey` in `auth/utils.ts`). This identity is stored in `state.playerIdentities` as a mapping from invite code to userId hash. The mapping is:

- Included in the `game_ended` SSE event payload (`playerIdentities: Record<string, string>`)
- Available via `engine.getPlayerIdentities(challengeId)` after the game ends
- Displayed in the leaderboard UI as truncated hex hashes in the Final Scores panel and on challenge cards
