# Ultimatum Game Challenge — Implementation Plan

## Files to create

### 1. `challenges/ultimatum/challenge.json`
Challenge metadata (name, description, player count, prompt explaining rules, available methods, color/icon).

### 2. `challenges/ultimatum/index.ts`
The main challenge operator. Heavily commented. Key design:

**Game State** (`UltimatumGameState`):
- `reservationValues: number[]` — each player's private minimum acceptable share
- `currentOffer: Record<string, number> | null` — the split currently on the table (maps agent_id → share)
- `lastOfferBy: number | null` — player index of proposer
- `acceptances: Set<number>` — which non-proposer players have accepted
- `round: number` — current round (1-indexed)
- `maxRounds: number` — configured limit
- `total: number` — the pot to split
- `turnOrder: number[]` — sequence of player indices for turns
- `turnIndex: number` — position within current round's turn order
- `turnOrderPolicy: string` — "round_robin" or "random"
- `actionHistory: Array<{round, player, action, details?}>` — full log

**Handlers** (registered via `this.handle()`):
- `submit_offer` — propose a split; validates shares sum to total, clears prior acceptances, sets new offer
- `accept` — accept current offer; only non-proposers can accept; if all non-proposers accept → agreement → endGame
- `reject` — reject current offer; clears offer and acceptances
- `pass` — skip turn (no-op, advance turn)
- `message_only` — send a message without taking a game action (does NOT advance turn)

**Turn & Round logic**:
- After each action (except `message_only`), advance to next turn
- When all players in a round have acted, increment round counter
- If `round > maxRounds`, deadlock → everyone gets 0 → endGame

**Scoring** (security=0 for all, utility = payoff):
- On agreement: `utility_i = x_i - v_i` (share minus reservation value)
- On deadlock: `utility_i = 0` for all (and `security = 0`)
- Security is always 0 (no security dimension in this game)

**Reservation value generation**:
- Uses `derivePrivateSeed` + `Prando` seeded RNG to deterministically generate each player's reservation value from `U[0, reservation_max]`

### 3. `challenges/ultimatum/challenge-operator.test.ts`
Operator-level tests with ChatEngine (no ArenaEngine):
- Basic 2-player game: offer → accept → game ends with correct payoffs
- Rejection clears offer and acceptances
- Deadlock after max rounds → all get 0
- Invalid offer (doesn't sum to total) → error
- Only non-proposers can accept
- Pass advances turn
- message_only does NOT advance turn
- N-player unanimous consent (3 players)

### 4. `challenges/ultimatum/engine-instance.test.ts`
Engine-level integration tests (through ArenaEngine):
- Full game through engine API
- Storage isolation between engine instances

## Files to modify

### 5. `challenges/package.json`
- Add export: `"./ultimatum": "./ultimatum/index.ts"`
- Add test script: `"test:ultimatum": "node --import tsx --test --test-force-exit ./ultimatum/**/*.test.ts"`

### 6. `api/config.json`
- Add ultimatum challenge entry with default options and scoring strategies
