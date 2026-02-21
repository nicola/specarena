import {
  ChallengeMessaging,
  ChallengeOperator,
  ChallengeOperatorState,
  ChallengeResultAttestationV1,
  ChallengeResultPayloadV1,
  ChallengeResultSigner,
  ChatMessage,
  Score,
} from "../types";
import { defaultChatEngine } from "../chat/ChatEngine";
import { canonicalizeJson, defaultChallengeResultSigner } from "../signing/ChallengeResultSigner";

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
export abstract class BaseChallenge<TGameState = {}> implements ChallengeOperator {
  protected challengeId: string;
  protected playerCount: number;
  protected messaging: ChallengeMessaging;
  protected signer: ChallengeResultSigner;
  state: ChallengeOperatorState;
  gameState: TGameState;
  private handlers = new Map<string, (msg: ChatMessage, playerIndex: number) => void | Promise<void>>();

  constructor(
    challengeId: string,
    playerCount: number,
    gameState: TGameState,
    messaging?: ChallengeMessaging,
    signer?: ChallengeResultSigner
  ) {
    this.challengeId = challengeId;
    this.playerCount = playerCount;
    this.messaging = messaging ?? defaultChatEngine;
    this.signer = signer ?? defaultChallengeResultSigner;
    this.state = {
      gameStarted: false,
      gameEnded: false,
      scores: Array.from({ length: playerCount }, (): Score => ({ security: 0, utility: 0 })),
      players: [],
    };
    this.gameState = gameState;
  }

  // --- Public interface (ChallengeOperator) ---

  // Admission flow used by the engine when a player joins with an invite.
  // Once playerCount is reached, the game transitions to started.
  async join(userId: string): Promise<void> {
    if (this.state.players.includes(userId)) {
      throw new Error("ERR_INVITE_ALREADY_USED: This invite has already been used.");
    }

    const playerIndex = this.state.players.push(userId) - 1;
    await this.onPlayerJoin(userId, playerIndex);

    if (this.state.players.length === this.playerCount) {
      this.state.gameStarted = true;
      await this.onGameStart();
    }
  }

  // Single entrypoint for challenge actions. Routes by message.type to the
  // handler registered with `handle(...)`.
  async message(message: ChatMessage): Promise<void> {
    if (this.state.gameEnded || !this.state.gameStarted) {
      await this.send("ERR_GAME_NOT_RUNNING: Game not running.", message.from);
      return;
    }

    const playerIndex = this.state.players.indexOf(message.from);
    if (playerIndex === -1) {
      throw new Error("ERR_PLAYER_NOT_FOUND: Player not found.");
    }

    const handler = this.handlers.get(message.type ?? "");
    if (!handler) {
      throw new Error(`Unknown challenge method: ${message.type}`);
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

  // --- Game lifecycle ---

  // Standard game-finalization helper used by challenges after scoring.
  // It emits a signed score attestation and a human-readable score summary.
  protected async endGame(): Promise<void> {
    if (this.state.gameEnded) {
      return;
    }

    const payload: ChallengeResultPayloadV1 = {
      challengeId: this.challengeId,
      endedAt: Date.now(),
      playersCount: this.playerCount,
      scores: this.state.scores.map((score, playerIndex) => ({
        playerIndex,
        security: score.security,
        utility: score.utility,
      })),
    };

    const canonicalPayload = canonicalizeJson(payload);
    const signature = await this.signer.sign(canonicalPayload);
    const attestation: ChallengeResultAttestationV1 = {
      kind: "arena.challenge_result.v1",
      payload,
      signature: {
        alg: this.signer.alg,
        kid: this.signer.keyId,
        sig: signature,
      },
    };

    await this.broadcast(JSON.stringify(attestation));

    const lines = this.state.scores.map(
      (s, i) => `- Player ${i + 1}: ${JSON.stringify(s)}`
    );
    await this.broadcast(`Game ended.\n\nScores are:\n${lines.join("\n")}`);
    this.state.gameEnded = true;
  }
}
