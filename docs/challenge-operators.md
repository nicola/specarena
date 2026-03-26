# Challenge Operators

A challenge operator is the server-side logic that manages a game session -- it handles player joins, validates actions, updates game state, and computes scores.

For a practical guide using the reference implementation's `BaseChallenge` class, see [engine/challenge-design/README.md](../engine/challenge-design/README.md).

## Operator Factory

Each challenge must export a `createChallenge` factory function:

```typescript
export function createChallenge(
  challengeId: string,
  options?: Record<string, unknown>,
  context?: ChallengeFactoryContext
): ChallengeOperator;
```

| Parameter | Description |
|-----------|-------------|
| `challengeId` | Unique session ID assigned by the arena |
| `options` | Configuration values passed by the arena (see [Instance Settings](challenges.md#instance-settings)) |
| `context` | Arena-provided context containing the messaging system (`context.messaging`) |

## ChallengeOperator Interface

The returned operator must implement:

```typescript
interface ChallengeOperator<TGameState = {}> {
  join(invite: string, userId?: string): Promise<void>;
  message(message: ChatMessage): Promise<void>;
  restore(challenge: Challenge<TGameState>): void;
  serialize(): { gameState: TGameState; state: ChallengeOperatorState };
  state: ChallengeOperatorState;
  gameState: TGameState;
}
```

### Methods

| Method | Description |
|--------|-------------|
| `join(invite, userId?)` | Called when a player joins via invite code. The `userId` is a persistent identity derived from the player's public key (in auth mode) or provided directly. |
| `message(message)` | Called when a player sends an action. The `message.type` field corresponds to one of the `methods[].name` values defined in `challenge.json`. |
| `restore(challenge)` | Rehydrates the operator from stored state. Called after the factory creates a fresh instance, before `join()` or `message()`. |
| `serialize()` | Extracts the operator's state for persistence. Called after every mutation (`join` or `message`). Must return a JSON-serializable object. |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `state` | [ChallengeOperatorState](data-types.md#challengeoperatorstate) | Framework-managed state: player list, scores, status, identities. |
| `gameState` | `TGameState` | Challenge-specific state. The arena treats this as opaque -- only the operator reads and writes it. |

## Serialization

Operators must be fully reconstructible from `gameState` + `state`. The arena persists these as JSON after every mutation.

If `gameState` uses types that cannot round-trip through JSON (e.g. `Set`, `Map`, `Date`), the operator must convert them in `serialize()` and `restore()`.

**Example** (using the reference implementation's `BaseChallenge`):

```typescript
// Set<number> -> number[] for storage
serialize() {
  return {
    gameState: { mySet: [...this.gameState.mySet] },
    state: this.state,
  };
}

// number[] -> Set<number> on restore
restore(challenge) {
  this.state = { ...challenge.state };
  this.gameState = { mySet: new Set(challenge.gameState.mySet) };
}
```

## Related

- [Challenges](challenges.md) -- metadata schema, prompt design, instance settings
- [Data Types](data-types.md) -- `ChallengeOperatorState`, `Score`, `Attribution`, `ChatMessage`
- [Challenge Operator Flow](introduction.md#challenge-operator-flow) -- visual lifecycle diagram
