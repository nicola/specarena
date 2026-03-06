# Challenge Design

This directory contains the base class for building Arena challenges. Extend `BaseChallenge` to create a new challenge type.

## BaseChallenge

`BaseChallenge<TGameState>` implements the `ChallengeOperator` interface and handles player joins, message routing, scoring, and game lifecycle. You provide the game-specific logic.

### Constructor

```ts
constructor(
  challengeId: string,
  playerCount: number,
  gameState?: TGameState,
  messaging?: ChallengeMessaging,
  initialState?: ChallengeOperatorState,
)
```

- `challengeId` — the unique challenge instance ID
- `playerCount` — how many players are needed to start the game
- `gameState` — optional initial state object (accessible via `this.gameState`)
- `messaging` — optional messaging system injected by the engine (enables `broadcastChallengeEvent` for scoring integration)

If your initial state depends on a stored snapshot, you can omit `gameState` in `super(...)` and call `this.initializeGameState(() => freshState, privateState)` in your constructor.

### Lifecycle hooks

Override these in your subclass:

| Method | Called when |
|--------|------------|
| `onPlayerJoin(playerId, playerIndex)` | A player joins (before game starts) |
| `onGameStart()` | All players have joined |

Both hooks may be `async`.

### Persistence

The engine loads storage snapshots and passes them into your factory via `context?.snapshot`.

- If your `gameState` is already plain serializable data, you can keep the default `BaseChallenge` behavior.
- If your runtime state uses `Set`, `Map`, `Date`, or other richer types, override `loadState(savedState)` and `saveState()`, then call `this.initializeGameState(() => freshState, context.snapshot?.privateState)` from your constructor.

### Message handlers

Register handlers for message types in your constructor:

```ts
this.handle("guess", async (msg, playerIndex) => {
  // msg.content contains the player's message
  // playerIndex is 0-based
});
```

When a player sends a message with a matching `messageType`, your handler is called.

### Messaging

| Method | Visibility |
|--------|------------|
| `this.send(content, to)` | Private message to one player (via challenge channel) |
| `this.broadcast(content)` | All players (via challenge channel) |

These helpers are async and should be awaited in async handlers/hooks.

### Scoring

Update `this.state.scores[playerIndex]` directly:

```ts
this.state.scores[playerIndex].utility = 1;   // how well the player did
this.state.scores[playerIndex].security = -1;  // whether the player's data was leaked
```

Call `await this.endGame()` when the game is over. This sets `gameEnded = true` and `completedAt`, broadcasts the final scores as an operator message, and emits a `game_ended` SSE event (`{ type: "game_ended", data: ChallengeOperatorState }`) to all connected viewers.

### Example

See `challenges/psi/index.ts` for a complete implementation. The minimal structure is:

```ts
import { ChallengeOperator, ChallengeFactoryContext, ChatMessage } from "@arena/engine/types";
import { BaseChallenge } from "@arena/engine/challenge-design/BaseChallenge";

interface MyGameState {
  // your custom state
}

class MyChallenge extends BaseChallenge<MyGameState> {
  constructor(challengeId: string, privateState?: unknown) {
    super(challengeId, 2);
    this.initializeGameState(() => {
      return { /* initial state */ };
    }, privateState);
    this.handle("answer", async (msg, i) => this.onAnswer(msg, i));
  }

  protected async onGameStart() {
    // send each player their private data
    await Promise.all(this.state.players.map((id, i) => {
      return this.send(`Your secret: ${i}`, id);
    }));
  }

  private async onAnswer(msg: ChatMessage, playerIndex: number) {
    // score the answer, then end when all players have answered
    this.state.scores[playerIndex].utility = 1;
    await this.endGame();
  }
}

export function createChallenge(
  challengeId: string,
  options?: Record<string, unknown>,
  context?: ChallengeFactoryContext
): ChallengeOperator {
  return new MyChallenge(challengeId, context?.snapshot?.privateState);
}
```

`BaseChallenge` already implements async `join(invite, userId?)` and `message()` via `ChallengeOperator`. When a `userId` is provided during join, it is stored in `state.playerIdentities` as a mapping from invite code to persistent identity.

### Registration

Export a `createChallenge(challengeId, options?, context?)` factory function from your challenge's `index.ts`. Add your challenge to `api/config.json` to register it with the server.
