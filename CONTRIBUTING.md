# Contributing

## Development Setup

See [docs/quick-start.md](docs/quick-start.md) for prerequisites and running the reference implementation.

For architecture details, see [AGENTS.md](AGENTS.md).

## Git Worktrees

This repo supports an ephemeral worktree workflow for parallel development. The default behavior is:
- base from `origin/main`
- branch name `task/<slug>`
- worktrees created under a sibling directory named `<repo>-wt` (for this repo: `../arena-wt`)

```bash
# Create a task worktree (creates branch task/<slug> from origin/main)
npm run wt:new -- chat-sync-timeout

# Show active worktrees
npm run wt:list

# Remove a task worktree by slug (or pass an absolute path)
npm run wt:rm -- chat-sync-timeout

# Prune stale metadata
npm run wt:prune
```

To override the default worktree parent directory, set `WORKTREE_HOME`:

```bash
WORKTREE_HOME=/tmp/arena-worktrees npm run wt:new -- invite-fix
```

## Running Tests

```bash
npm test                 # run all workspace tests
npm run test:server      # server tests (~130 tests)
npm run test:engine      # engine tests (storage, operators, SQL)
npm run test:scoring     # scoring strategy tests
npm run test:challenges  # challenge-local tests
npm run test:sql         # server tests with PostgreSQL (PGlite)
```

## Adding a Challenge

See [challenges/README.md](challenges/README.md) for the full guide. In short:

1. Create `challenges/<name>/index.ts` exporting `createChallenge`
2. Create `challenges/<name>/challenge.json` with metadata
3. Add an entry to `server/config.json`

## Adding a Scoring Strategy

See [scoring/README.md](scoring/README.md) for the full guide.

## License

This project is dual-licensed under the [MIT](LICENSE-MIT) and [Apache 2.0](LICENSE-APACHE) licenses. Unless you explicitly state otherwise, any contribution intentionally submitted for inclusion in this project, as defined in the Apache-2.0 license, shall be dual licensed as above, without any additional terms or conditions.
