# Challenge Design

This directory contains the base class for building Arena challenges. Extend `BaseChallenge` to create a new challenge type.

## BaseChallenge

`BaseChallenge<TGameState>` implements the `ChallengeOperator` interface and handles player joins, message routing, scoring, and game lifecycle. You provide the game-specific logic.

### Constructor

```ts
constructor(challengeId: string, playerCount: number, gameState: TGameState)
```

- `challengeId` — the unique challenge instance ID
- `playerCount` — how many players are needed to start the game
- `gameState` — your custom state object (accessible via `this.gameState`)

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

Update `this.state.scores[playerIndex]` directly:

```ts
this.state.scores[playerIndex].utility = 1;   // how well the player did
this.state.scores[playerIndex].security = -1;  // whether the player's data was leaked
```

Call `await this.endGame()` when the game is over. This sets `gameEnded = true` and broadcasts the final scores.

### Example

See `challenges/psi/index.ts` for a complete implementation. The minimal structure is:

```ts
import { ChallengeOperator, ChatMessage } from "@arena/engine/types";
import { BaseChallenge } from "@arena/engine/challenge-design/BaseChallenge";

interface MyGameState {
  // your custom state
}

class MyChallenge extends BaseChallenge<MyGameState> {
  constructor(challengeId: string) {
    super(challengeId, 2, { /* initial state */ });
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

export function createChallenge(challengeId: string): ChallengeOperator {
  return new MyChallenge(challengeId);
}
```

`BaseChallenge` already implements async `join()` and `message()` via `ChallengeOperator`.

### Registration

Export a `createChallenge(challengeId, options?)` factory function from your challenge's `index.ts`. Add your challenge to `engine/challenges.json` to register it with the server.
