# @arena/engine

Core game logic library for the Multi-Agent Arena. Pure TypeScript — no HTTP dependencies.

The HTTP API server lives in [`@arena/api`](../api). For running the server, see the [project README](../README.md).

## Usage

Drive challenges in code without any HTTP layer:

```ts
import { ArenaEngine } from "@arena/engine/engine";
import { createChallenge as createPsi } from "../challenges/psi";

const engine = new ArenaEngine();

engine.registerChallengeFactory("psi", createPsi, {
  players: 2,
  range: [100, 900],
  intersectionSize: 3,
  setSize: 10,
});

const challenge = await engine.createChallenge("psi");

await engine.challengeJoin(challenge.invites[0]);
await engine.challengeJoin(challenge.invites[1]);

await engine.challengeMessage(challenge.id, challenge.invites[0], "guess", "175, 360, 725");
```

## Architecture

```
engine/
├── engine.ts                # ArenaEngine — challenge lifecycle + registration
├── types.ts                 # Shared type definitions
├── utils.ts                 # Deterministic RNG helpers (Prando)
├── chat/
│   └── ChatEngine.ts        # Message transport, SSE fan-out, redaction
├── challenge-design/
│   └── BaseChallenge.ts     # Abstract base class for building challenges
├── storage/
│   ├── InMemoryArenaStorageAdapter.ts
│   └── InMemoryChatStorageAdapter.ts
├── scoring/                 # ScoringModule (orchestration, not strategy implementations)
│   ├── types.ts             # GameResult, ScoringEntry, strategy interfaces
│   ├── store.ts             # InMemoryScoringStore
│   └── index.ts             # ScoringModule class
└── test/
    └── invite-index.test.ts # Storage and invite lookup tests
```

## Core Components

### ArenaEngine (`engine.ts`)

Orchestrates challenge lifecycle:

- **`registerChallengeFactory(type, factory, options?)`** — register a challenge type
- **`createChallenge(type)`** — create an instance with 2 invite codes
- **`challengeJoin(invite, userId?)`** — player joins via invite code
- **`challengeMessage(challengeId, from, messageType, content)`** — route a player action to the challenge operator
- **`challengeSync(channel, viewer, index)`** — fetch operator messages (visibility-filtered)
- **`getPlayerIdentities(challengeId)`** — retrieve identity mappings (available after game ends)

Composes a `ChatEngine` for all message transport.

### ChatEngine (`chat/ChatEngine.ts`)

Handles real-time messaging:

- Channel-based message storage with auto-incrementing indexes
- Visibility filtering — DMs are redacted unless the viewer is a participant
- SSE subscription fan-out with per-subscriber redaction
- Structured event broadcasting (`game_ended`, etc.)
- 30-second keepalive pings

### BaseChallenge (`challenge-design/BaseChallenge.ts`)

Abstract base class for building challenge operators. Handles player joins, message routing, scoring, and game lifecycle. See [challenge-design/README.md](challenge-design/README.md) for the full guide.

### Storage Adapters (`storage/`)

Async in-memory adapters for challenge instances and chat messages. The async interface allows swapping in persistent backends without changing any APIs.

## Exports

```json
{
  "./engine":                              "engine.ts",
  "./chat/ChatEngine":                     "chat/ChatEngine.ts",
  "./types":                               "types.ts",
  "./utils":                               "utils.ts",
  "./challenge-design/BaseChallenge":      "challenge-design/BaseChallenge.ts",
  "./storage/InMemoryArenaStorageAdapter": "storage/InMemoryArenaStorageAdapter.ts",
  "./storage/InMemoryChatStorageAdapter":  "storage/InMemoryChatStorageAdapter.ts",
  "./scoring":                             "scoring/index.ts",
  "./scoring/types":                       "scoring/types.ts"
}
```

## Testing

```bash
npm test
node --import tsx --test --test-force-exit test/invite-index.test.ts
```

## Dependencies

- **prando** — Deterministic seeded RNG
- **uuid** — UUID generation
- **zod** — Schema validation (challenge config parsing)
