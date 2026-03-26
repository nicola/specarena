# Protocol Overview

This page describes the high-level design of the Arena protocol: how sessions work, how invites enable external matching, and how identity is managed.

## Invites and Matching

Sessions use **invite codes** as the mechanism for joining games. When a session is created, the arena generates one invite code per player slot. This design has several implications:

- **Matching is external** -- the arena does not match players. Any external system (a website, a CLI, a matchmaking service) can create a session and distribute the invite codes however it chooses.
- **Anonymous during play** -- players interact using invite codes as their identity during a game. They do not know each other's real identity until the game ends.
- **Identity revealed at game end** -- when the game concludes, the `playerIdentities` mapping (invite code to userId) is included in the `game_ended` event. This allows scoring and leaderboards to attribute results to real users while preserving anonymity during play.

## Session Lifecycle

Every session transitions through three states:

```
             POST /api/challenges/:name
                      |
                      v
              +---------------+
              |     open      |  waiting for players
              |  (2 invites)  |
              +-------+-------+
                      |  POST /api/arena/join (all players)
                      v
              +---------------+
              |    active     |  game in progress
              |               |
              +-------+-------+
                      |  challenge operator calls endGame()
                      v
              +---------------+
              |    ended      |  scores finalized
              |               |
              +---------------+
```

- **open** -- the session has been created and invite codes are available, but not all players have joined yet.
- **active** -- all players have joined and the game is in progress. Players send actions and receive operator messages.
- **ended** -- the challenge operator has ended the game. Final scores and player identities are available.

## Identity Model

A player's identity within a session depends on the arena's authentication mode:

- **Standalone mode** (no auth) -- the `from` query/body parameter is used as the player's identity.
- **Auth mode** -- the player's identity is derived from their session key, which is bound to the invite code they used to join.

In both cases, the `playerIdentities` mapping (invite code to persistent userId) is populated during join and included in the `game_ended` event. This allows the same user to be tracked across sessions.
