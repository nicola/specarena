# Storage Architecture

## Data Model

### Types

```
ChallengeRecord          (engine/types.ts)
  id:            string
  name:          string
  createdAt:     number
  challengeType: string
  invites:       string[]          two invite tokens per challenge
  state:         ChallengeOperatorState

Challenge extends ChallengeRecord
  instance:      ChallengeOperator  live operator (join, message methods)

ChatMessage              (engine/types.ts)
  channel:       string
  from:          string
  to?:           string | null      null = broadcast, string = DM
  content:       string
  index?:        number
  timestamp:     number
  type?:         string
  redacted?:     boolean

UserProfile              (storage/types.ts)
  userId:        string
  username?:     string
  model?:        string
```

### State inside a challenge

`ChallengeOperatorState` is the serializable game state owned by each challenge operator:

```
gameStarted:       boolean
gameEnded:         boolean
completedAt?:      number
scores:            Score[]           one per player
players:           string[]          invite tokens of joined players
playerIdentities:  Record<string, string>   invite -> userId
attributions?:     Attribution[]
```

The `state` object is shared by reference between the `ChallengeRecord` and the `ChallengeOperator`. When the operator mutates `this.state.gameStarted = true`, the record's `state` reflects the change immediately (same object).

## Storage Adapters

Four adapter interfaces, each with an in-memory implementation:

| Adapter | Interface file | InMemory implementation | Stored type |
|---------|---------------|------------------------|-------------|
| Arena | `storage/types.ts` | `InMemoryArenaStorageAdapter` | `ChallengeRecord` |
| Chat | `storage/types.ts` | `InMemoryChatStorageAdapter` | `ChatMessage` |
| User | `storage/types.ts` | `InMemoryUserStorageAdapter` | `UserProfile` |
| Scoring | `@arena/scoring` | `InMemoryScoringStorageAdapter` | `ScoringEntry` + strategy state |

All adapter methods are `async` so implementations can be swapped to SQL without changing callers.

## Operator Lifecycle

The `ChallengeOperator` is the live object that handles `join()` and `message()` calls. It is not part of `ChallengeRecord` — storage adapters only know about serializable record data.

### Creation

```
createChallenge(type)
  1. factory(id, options, { messaging }) -> ChallengeOperator
  2. Build Challenge = { ...record fields, state: instance.state, instance }
  3. storageAdapter.setChallenge(challenge)
     - typed as ChallengeRecord, but the JS object carries `instance` as an extra property
```

### Retrieval

```
getChallenge(id)
  1. record = storageAdapter.getChallenge(id)
  2. attachOperator(record)
     a. 'instance' in record?  -> return as Challenge (already attached)
     b. otherwise              -> reconstruct from factory, set instance.state = record.state
                                  Object.assign(record, { instance })
```

### Why this works for in-memory

`InMemoryArenaStorageAdapter` stores objects by reference in a plain JS object (`challengesById`). When `setChallenge(challenge)` is called with a `Challenge` object, the stored reference still has the `instance` property — it's just invisible to TypeScript's `ChallengeRecord` type. On retrieval, `attachOperator` sees `'instance' in record` is true and returns it directly. No reconstruction needed.

### What changes for SQL

A SQL adapter returns a fresh `ChallengeRecord` deserialized from the database. It has no `instance` property. `attachOperator` hits the reconstruction path:

1. Looks up the factory by `record.challengeType`
2. Creates a new operator via `factory(id, options, { messaging })`
3. Restores state with `instance.state = record.state`
4. Attaches with `Object.assign(record, { instance })`

Challenge-specific runtime state (guesses, round data) must live inside `ChallengeOperatorState` to survive this reconstruction. Anything not in `state` is lost between requests.

## Chat Channels

Each challenge uses two chat channels:

| Channel | Key | Purpose |
|---------|-----|---------|
| Player chat | `<challengeId>` | Messages between players |
| Operator log | `challenge_<challengeId>` | System/operator messages (join events, guesses, results) |

Both are deleted when a challenge is pruned as stale.

## Invite Index

`InMemoryArenaStorageAdapter` maintains a reverse index `inviteToChallengeId: Record<string, string>` for O(1) invite lookups. This index is updated on `setChallenge` and `deleteChallenge`. A SQL adapter would use a column index instead.

## Stale Challenge Cleanup

Challenges that haven't ended within `STALE_CHALLENGE_TIMEOUT_MS` (10 minutes) are considered stale. Cleanup is triggered lazily by `getChallenge()` — if the retrieved record is stale, it's deleted before returning `undefined`. `pruneStaleChallenges()` exists for batch cleanup but is not called automatically.

Deletion removes: the challenge record, invite index entries, and both chat channels.
