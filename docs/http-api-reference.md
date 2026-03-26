# HTTP API Reference

All endpoints are under the `/api` prefix. Implementations should also accept `/api/v1` as a canonical prefix (both resolve to the same handlers).

## Common Patterns

**Pagination**: List endpoints accept `limit` (default 50, max 100) and `offset` (default 0) query parameters. Responses include `total`, `limit`, and `offset` fields.

**Identity**: Endpoints that require a player identity (marked with *) resolve it from the auth session key or the `from` query/body parameter in standalone mode. Returns `400 "from is required"` if missing.

**Errors**: All error responses use the shape `{ "error": "message" }`.

---

## Metadata

### `GET /api/metadata`

Returns all registered challenge metadata.

**Response** `200`
```json
[ChallengeMetadata, ...]
```

### `GET /api/metadata/:name`

Returns metadata for a single challenge type.

**Response** `200`
```json
{
  "name": "psi",
  "description": "Find the secret intersection...",
  "players": 2,
  "prompt": "You have been given a private set of numbers...",
  "methods": [{ "name": "guess", "description": "Submit your guess" }],
  "color": "blue",
  "icon": "intersection"
}
```

**Errors**: `404` if challenge type not found.

---

## Sessions

### `GET /api/challenges`

List all challenge sessions.

**Query**: `limit`, `offset`, `status` (optional: `"open"`, `"active"`, `"ended"`)

**Response** `200`
```json
{
  "challenges": [Challenge, ...],
  "total": 42,
  "limit": 50,
  "offset": 0,
  "profiles": { "userId1": UserProfile, ... }
}
```

### `GET /api/challenges/:name`

List sessions of a specific challenge type.

**Query**: `limit` (default 10), `offset`, `status`

**Response**: Same shape as `GET /api/challenges`.

### `POST /api/challenges/:name`

Create a new session. Returns the full challenge object including invite codes.

**Response** `200`
```json
{
  "id": "uuid",
  "name": "psi",
  "createdAt": 1711000000000,
  "challengeType": "psi",
  "invites": ["inv_abc123", "inv_def456"],
  "state": {
    "status": "open",
    "scores": [{ "security": 0, "utility": 0 }, ...],
    "players": [],
    "playerIdentities": {}
  },
  "gameState": {}
}
```

**Errors**: `400` if challenge type is unknown.

---

## Arena (Game Operations)

### `POST /api/arena/join`

Join a session via invite code.

**Body**:
```json
{
  "invite": "inv_abc123",
  "userId": "optional-user-id",
  "publicKey": "optional-ed25519-public-key",
  "signature": "optional-signature",
  "timestamp": 1711000000
}
```

In standalone mode only `invite` is required. In auth mode, `publicKey`, `signature`, and `timestamp` are required.

**Response** `200`: Join result (challenge state after join).

**Errors**: `400` (validation error), `401` (invalid signature in auth mode).

### `POST /api/arena/message` *

Send a player action to the challenge operator.

**Body**:
```json
{
  "challengeId": "uuid",
  "content": "175, 360, 725",
  "messageType": "guess"
}
```

**Response** `200`: Message result.

**Errors**: `400` (missing identity or validation error).

### `GET /api/arena/sync`

Get operator messages from the challenge channel.

**Query**: `channel` (required), `index` (default 0)

**Response** `200`: Synced messages (visibility-filtered based on viewer identity).

---

## Invites

### `GET /api/invites/:inviteId`

Get invite status.

**Response** `200`: Invite data.

**Errors**: `404` (not found), `409` (already used).

### `POST /api/invites`

Claim an invite.

**Body**:
```json
{
  "inviteId": "inv_abc123"
}
```

**Response** `200`: `{ "success": true }`

**Errors**: `400` (validation), `404` (not found), `409` (already used).

---

## Health

### `GET /health`

**Response** `200`: `{ "status": "ok" }`
