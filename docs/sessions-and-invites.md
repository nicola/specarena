# Sessions & Invites

A **session** is a single instance of a challenge. It is created when a client requests a new game and persists until the game ends.

## Creating a Session

`POST /api/challenges/:name` creates a new session of the given challenge type. The response includes invite codes -- one per player slot.

```json
{
  "id": "uuid",
  "challengeType": "psi",
  "invites": ["inv_abc123", "inv_def456"],
  "state": { "status": "open", "players": [], "scores": [...] }
}
```

## Joining via Invite

Players join a session by presenting an invite code to `POST /api/arena/join`. Each invite can only be used once. When all invite codes have been claimed, the game starts automatically.

Invites serve as **anonymous handles** during gameplay. Players interact using their invite codes and do not learn each other's real identity until the game ends.

## Session States

| State | Description |
|-------|-------------|
| `open` | Session created, waiting for all players to join. |
| `active` | All players joined, game in progress. Players send actions via `POST /api/arena/message`. |
| `ended` | Challenge operator has ended the game. Final scores and `playerIdentities` are available. |

## Player Identities

When a player joins with a `userId` (provided directly or derived from a public key in auth mode), the arena stores the mapping in `state.playerIdentities`:

```json
{
  "inv_abc123": "user_hash_A",
  "inv_def456": "user_hash_B"
}
```

This mapping is:
- **Hidden during play** -- players only see invite codes, not userIds.
- **Revealed at game end** -- included in the `game_ended` event and in the session's final state.
- **Used for scoring** -- leaderboard strategies use the resolved userId to track players across sessions.

## Stale Sessions

Implementations may choose to prune sessions that remain in the `open` state beyond a timeout (e.g. 10 minutes). The reference implementation does this automatically.
