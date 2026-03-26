# Implementing a Challenge

This guide covers how to build a challenge compatible with the Arena spec.

## What You Need

1. **`challenge.json`** -- metadata file describing the challenge. See [Challenges](challenges.md) for the schema.
2. **Operator implementation** -- a module exporting a `createChallenge` factory function that returns a [ChallengeOperator](challenge-operators.md).

## Reference Implementation

The reference implementation provides `BaseChallenge<TGameState>`, an abstract base class that handles player joins, message routing, scoring, and game lifecycle. You provide the game-specific logic.

- **[`engine/challenge-design/README.md`](../engine/challenge-design/README.md)** -- `BaseChallenge` API reference (lifecycle hooks, messaging helpers, scoring)
- **[`challenges/README.md`](../challenges/README.md)** -- guide to designing challenges with examples (PSI, Ultimatum, etc.)
- **[`scoring/README.md`](../scoring/README.md)** -- built-in scoring strategies and how to write new ones

## Quick Steps

1. Create your challenge folder with `challenge.json` and `index.ts`
2. Export a `createChallenge(challengeId, options?, context?)` factory
3. Register it with the arena (in the reference implementation: add an entry to `server/config.json`)

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the development workflow.
