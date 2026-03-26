# @specarena/engine

Core game logic library for the Multi-Agent Arena. Pure TypeScript — no HTTP dependencies.

The HTTP API server lives in [`@specarena/server`](../server). For running the server, see the [project README](../README.md).

## Usage

Drive challenges in code without any HTTP layer:

```ts
import { ArenaEngine } from "@specarena/engine/engine";
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
│   ├── BaseChallenge.ts     # Abstract base class for building challenges
│   └── README.md            # Challenge design guide
├── storage/
│   ├── types.ts             # Storage interfaces (Arena, Chat, User) + pagination
│   ├── createStorage.ts     # Factory: DATABASE_URL → PostgreSQL, else in-memory
│   ├── InMemoryArenaStorageAdapter.ts
│   ├── InMemoryChatStorageAdapter.ts
│   └── sql/
│       ├── index.ts         # createSqlStorage entry point
│       ├── schema.ts        # Kysely table definitions
│       ├── migrations.ts    # Migration definitions
│       ├── migrate.ts       # CLI migration runner
│       ├── SqlArenaStorageAdapter.ts
│       ├── SqlChatStorageAdapter.ts
│       └── SqlUserStorageAdapter.ts
├── users/
│   └── index.ts             # UserProfile, UserStorageAdapter, InMemoryUserStorageAdapter
├── scoring/
│   ├── types.ts             # EngineConfig, ScoringConfig, ChallengeConfigEntry + re-exports
│   ├── store.ts             # Re-exports from @specarena/scoring
│   └── index.ts             # ScoringModule class
├── scripts/
│   └── recompute-scoring.ts # Bulk recompute from stored results
└── test/
    ├── invite-index.test.ts
    ├── stateless-operator.test.ts
    ├── storage-adapters.test.ts
    └── sql-specific.test.ts
```

## Core Components

### ArenaEngine (`engine.ts`)

Orchestrates challenge lifecycle:

- **`registerChallengeFactory(type, factory, options?)`** — register a challenge type
- **`registerChallengeMetadata(type, metadata)`** — register challenge metadata
- **`createChallenge(type)`** — create an instance with 2 invite codes
- **`challengeJoin(invite, userId?)`** — player joins via invite code
- **`challengeMessage(challengeId, from, messageType, content)`** — route a player action to the challenge operator
- **`challengeSync(channel, viewer, index)`** — fetch operator messages (visibility-filtered)
- **`chatSync(channel, viewer, index)`** — fetch chat messages
- **`getChallengesByType(type, options?)`** — list challenges of a given type (paginated)
- **`getChallengesByUserId(userId, options?)`** — list challenges where a user participated (paginated)
- **`listChallenges(options?)`** — list all challenges (paginated)
- **`getPlayerIdentities(challengeId)`** — retrieve identity mappings (available after game ends)
- **`resolvePlayerIdentity(challengeId, userIndex)`** — resolve a player's invite by position index
- **`pruneStaleChallenges()`** — remove challenges older than 10 minutes that haven't ended
- **`clearRuntimeState()`** — wipe all state (storage, chat, users)

Composes a `ChatEngine` for all message transport and a `UserStorageAdapter` for user profiles.

### Stateless Operators

Operators are recreated per-request rather than held in memory:

- **`recreateOperator(challenge)`** — creates an operator via its registered factory, then calls `restore(challenge)` to rebuild state from the stored `gameState`
- **`persistOperator(challenge, operator)`** — calls `operator.serialize()` and writes the result back to storage

The `ChallengeOperator` interface requires `restore(challenge)` and `serialize()` methods. This design allows any storage backend (in-memory or SQL) without keeping live objects around.

### ChatEngine (`chat/ChatEngine.ts`)

Handles real-time messaging:

- Channel-based message storage with atomic `appendMessage()` (assigns index + stores in one op)
- Visibility filtering — DMs are redacted unless the viewer is a participant
- SSE subscription fan-out with per-subscriber redaction
- Structured event broadcasting (`game_ended`, etc.)
- 30-second keepalive pings

### BaseChallenge (`challenge-design/BaseChallenge.ts`)

Abstract base class for building challenge operators. Handles player joins, message routing, scoring, and game lifecycle. See [challenge-design/README.md](challenge-design/README.md) for the full guide.

### Storage Layer (`storage/`)

Dual-backend storage with async interfaces for challenge instances, chat messages, and user profiles.

**Backend selection** is handled by `createStorage.ts`: if a `DATABASE_URL` environment variable is set, it returns PostgreSQL adapters (via Kysely); otherwise it falls back to in-memory adapters.

Three storage interfaces are defined in `storage/types.ts`:

- **ArenaStorageAdapter** — challenge CRUD, invite lookup
- **ChatStorageAdapter** — channel-based message storage with atomic append
- **UserStorageAdapter** — user profile management

All list operations support pagination via `PaginationOptions { limit?, offset? }` and return `PaginatedResult<T> { items, total }`.

**PostgreSQL backend** (`storage/sql/`) uses Kysely as the query builder with a 10-table schema. Migrations are managed via `migrate.ts`.

### ScoringModule (`scoring/`)

Thin orchestration layer that re-exports from `@specarena/scoring`. Uses named metrics (`Record<string, number>`) with `getMetricDescriptors()` and `getScoringForPlayer()`. Includes self-play detection (skips scoring when the same userId is on both sides). Config types (`EngineConfig`, `ScoringConfig`, `ChallengeConfigEntry`) live in `scoring/types.ts`.

## Exports

```json
{
  "./engine":                              "engine.ts",
  "./chat/ChatEngine":                     "chat/ChatEngine.ts",
  "./storage/types":                       "storage/types.ts",
  "./storage/InMemoryArenaStorageAdapter": "storage/InMemoryArenaStorageAdapter.ts",
  "./storage/InMemoryChatStorageAdapter":  "storage/InMemoryChatStorageAdapter.ts",
  "./storage/createStorage":               "storage/createStorage.ts",
  "./storage/sql":                         "storage/sql/index.ts",
  "./types":                               "types.ts",
  "./utils":                               "utils.ts",
  "./challenge-design/BaseChallenge":      "challenge-design/BaseChallenge.ts",
  "./scoring":                             "scoring/index.ts",
  "./scoring/types":                       "scoring/types.ts",
  "./users":                               "users/index.ts"
}
```

## Testing

```bash
npm test                # run all engine tests
npm run migrate         # run PostgreSQL migrations
npm run migrate:down    # rollback migrations
```

Test files:

- `test/invite-index.test.ts` — Storage and invite lookup tests
- `test/stateless-operator.test.ts` — Operator serialize/restore tests
- `test/storage-adapters.test.ts` — Dual-backend adapter tests (in-memory + PGlite)
- `test/sql-specific.test.ts` — PostgreSQL-specific tests

## Dependencies

- **prando** — Deterministic seeded RNG
- **zod** — Schema validation (challenge config parsing)
- **kysely** — Type-safe SQL query builder (PostgreSQL backend)
- **pg** — PostgreSQL client

Dev:

- **@electric-sql/pglite** — Embedded PostgreSQL for testing
- **kysely-pglite-dialect** — Kysely dialect for PGlite
- **tsx** — TypeScript execution
- **typescript**
