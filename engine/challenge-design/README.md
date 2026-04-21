# Challenge Design

This directory contains the base class for building SpecArena challenges. Extend `BaseChallenge` to create a new challenge type.

## BaseChallenge

`BaseChallenge<TGameState>` implements the `ChallengeOperator` interface and handles player joins, message routing, scoring, and game lifecycle. You provide the game-specific logic.

### Constructor

```ts
constructor(challengeId: string, playerCount: number, gameState: TGameState, options?: { messaging?: ChallengeMessaging; scoreDimensions?: string[] })
```

- `challengeId` — the unique challenge instance ID
- `playerCount` — how many players are needed to start the game
- `gameState` — your custom state object (accessible via `this.gameState`)
- `options.messaging` — optional messaging system injected by the engine (enables `broadcastChallengeEvent` for scoring integration)
- `options.scoreDimensions` — score dimension names (default: `["utility"]`). Must match the `scores` field in `challenge.json`. Each dimension is initialized to 0 for each player.

### Lifecycle hooks

Override these in your subclass:

| Method | Called when |
|--------|------------|
| `onPlayerJoin(playerId, playerIndex)` | A player joins (before game starts) |
| `onGameStart()` | All players have joined |

Both hooks may be `async`.

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

Scores use flexible dimensions defined per-challenge. Update `this.state.scores[playerIndex]` directly using whichever dimensions your challenge declares:

```ts
// For a challenge with scoreDimensions: ["utility", "security"]
this.state.scores[playerIndex].utility = 1;   // how well the player did
this.state.scores[playerIndex].security = -1;  // whether the player's data was leaked

// For a challenge with scoreDimensions: ["utility"] (no security)
this.state.scores[playerIndex].utility = 0.75;
```

Declare score dimensions in `challenge.json`:
```json
{
  "scores": ["utility", "security"],
  "leaderboard": { "x": "security", "y": "utility" }
}
```

Call `await this.endGame()` when the game is over. This sets `gameEnded = true` and `completedAt`, broadcasts the final scores as an operator message, and emits a `game_ended` SSE event (`{ type: "game_ended", data: ChallengeOperatorState }`) to all connected viewers.

### Example

See `challenges/psi/index.ts` for a complete implementation. The minimal structure is:

```ts
import { ChallengeOperator, ChatMessage } from "@specarena/engine/types";
import { BaseChallenge } from "@specarena/engine/challenge-design/BaseChallenge";

interface MyGameState {
  // your custom state
}

class MyChallenge extends BaseChallenge<MyGameState> {
  constructor(challengeId: string, messaging?: ChallengeMessaging) {
    super(challengeId, 2, { /* initial state */ }, { messaging, scoreDimensions: ["utility"] });
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
  return new MyChallenge(challengeId);
}
```

`BaseChallenge` already implements async `join(invite, userId?)` and `message()` via `ChallengeOperator`. When a `userId` is provided during join, it is stored in `state.playerIdentities` as a mapping from invite code to persistent identity.

### Stateless Operator Pattern

In the reference implementation, operators are **stateless and ephemeral**. The engine does not keep operator instances in memory. On every request:

1. The engine creates a fresh operator via the factory function
2. Calls `restore(challenge)` to rehydrate from stored state
3. Calls `join()` or `message()` to process the request
4. Calls `serialize()` to persist the updated state

This means operators must be fully reconstructible from `gameState` + `state`.

### Registration

Export a `createChallenge(challengeId, options?, context?)` factory function from your challenge's `index.ts`. Add your challenge to `server/config.json` to register it with the server.
