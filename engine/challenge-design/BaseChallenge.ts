import { ChallengeMessaging, ChallengeOperator, ChallengeOperatorError, ChallengeOperatorState, ChallengeStatus, ChatMessage, Score, Challenge } from "../types";
import { defaultChatEngine } from "../chat/ChatEngine";

// BaseChallenge provides the shared "operator runtime" used by challenge
// implementations:
// - player lifecycle (join -> game start)
// - method dispatch (`message` -> registered handler)
// - canonical score/game state bookkeeping
// - operator messaging primitives backed by ChatEngine/ChallengeMessaging
//
// Challenge authors are expected to focus on game-specific logic by:
// 1) overriding hooks (`onPlayerJoin`, `onGameStart`)
// 2) registering handlers via `handle("method", handler)`
export abstract class BaseChallenge<TGameState> implements ChallengeOperator<TGameState> {
  protected challengeId: string;
  protected playerCount: number;
  protected messaging: ChallengeMessaging;
  state: ChallengeOperatorState;
  gameState: TGameState;
  private handlers = new Map<string, (msg: ChatMessage, playerIndex: number) => void | Promise<void>>();

  constructor(challengeId: string, playerCount: number, gameState: TGameState, messaging?: ChallengeMessaging) {
    this.challengeId = challengeId;
    this.playerCount = playerCount;
    this.messaging = messaging ?? defaultChatEngine;
    this.state = {
      status: ChallengeStatus.Open,
      scores: Array.from({ length: playerCount }, (): Score => ({ security: 0, utility: 0 })),
      players: [],
      playerIdentities: {},
    };
    this.gameState = gameState;
  }

  // --- Public interface (ChallengeOperator) ---

  // Admission flow used by the engine when a player joins with an invite.
  // Once playerCount is reached, the game transitions to started.
  async join(invite: string, userId?: string): Promise<void> {
    if (this.state.players.includes(invite)) {
      throw new ChallengeOperatorError("INVITE_ALREADY_USED", "This invite has already been used.");
    }

    if (userId) {
      this.state.playerIdentities[invite] = userId;
    }

    const playerIndex = this.state.players.push(invite) - 1;
    await this.onPlayerJoin(invite, playerIndex);

    if (this.state.players.length === this.playerCount) {
      this.state.status = ChallengeStatus.Active;
      await this.onGameStart();
    }
  }

  // Single entrypoint for challenge actions. Routes by message.type to the
  // handler registered with `handle(...)`.
  async message(message: ChatMessage): Promise<void> {
    if (this.state.status !== ChallengeStatus.Active) {
      await this.send("ERR_GAME_NOT_RUNNING: Game not running.", message.from);
      return;
    }

    const playerIndex = this.state.players.indexOf(message.from);
    if (playerIndex === -1) {
      throw new ChallengeOperatorError("PLAYER_NOT_FOUND", "Player not found.");
    }

    const handler = this.handlers.get(message.type ?? "");
    if (!handler) {
      throw new ChallengeOperatorError("UNKNOWN_METHOD", `Unknown challenge method: ${message.type}`);
    }

    await handler(message, playerIndex);
  }

  // --- Lifecycle hooks for subclasses ---

  protected onPlayerJoin(_playerId: string, _playerIndex: number): void | Promise<void> {}
  protected onGameStart(): void | Promise<void> {}

  // --- Registration ---

  // Register a game-specific method handler (e.g. "guess", "submit").
  protected handle(type: string, handler: (msg: ChatMessage, playerIndex: number) => void | Promise<void>): void {
    this.handlers.set(type, handler);
  }

  // --- Messaging helpers ---

  // Private operator message to a single player on the challenge channel.
  protected async send(content: string, to?: string): Promise<void> {
    await this.messaging.sendChallengeMessage(this.challengeId, "operator", content, to);
  }

  // Broadcast operator message to all players on the challenge channel.
  protected async broadcast(content: string): Promise<void> {
    await this.messaging.sendChallengeMessage(this.challengeId, "operator", content);
  }

  // --- Attribution ---

  // Record an attribution (e.g. which player caused a security breach).
  protected addAttribution(from: number, to: number, type: string): void {
    if (!this.state.attributions) {
      this.state.attributions = [];
    }
    this.state.attributions.push({ from, to, type });
  }

  // --- Game lifecycle ---

  // Standard game-finalization helper used by challenges after scoring.
  // It marks the game ended and emits a canonical score summary.
  protected async endGame(): Promise<void> {
    this.state.status = ChallengeStatus.Ended;
    this.state.completedAt = Date.now();
    const lines = this.state.scores.map(
      (s, i) => `- Player ${i + 1}: ${JSON.stringify(s)}`
    );
    await this.broadcast(`Game ended.\n\nScores are:\n${lines.join("\n")}`);
    this.messaging.broadcastChallengeEvent?.(this.challengeId, {
      type: "game_ended",
      data: this.state,
    });
  }

  restore(challenge: Challenge<TGameState>): void {
    this.state = structuredClone(challenge.state);
    this.gameState = structuredClone(challenge.gameState);
  }

  serialize(): { gameState: TGameState; state: ChallengeOperatorState } {
    return { gameState: structuredClone(this.gameState), state: structuredClone(this.state) };
  }
}
