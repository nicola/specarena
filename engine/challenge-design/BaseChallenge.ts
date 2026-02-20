import { ChallengeMessaging, ChallengeOperator, ChallengeOperatorState, ChatMessage, Score } from "../types";
import { sendChallengeMessage, sendMessage } from "../storage/chat";

export abstract class BaseChallenge<TGameState = {}> implements ChallengeOperator {
  protected challengeId: string;
  protected playerCount: number;
  protected messaging: ChallengeMessaging;
  state: ChallengeOperatorState;
  gameState: TGameState;

  private handlers = new Map<string, (msg: ChatMessage, playerIndex: number) => void>();

  constructor(challengeId: string, playerCount: number, gameState: TGameState, messaging?: ChallengeMessaging) {
    this.challengeId = challengeId;
    this.playerCount = playerCount;
    this.messaging = messaging ?? { sendMessage, sendChallengeMessage };
    this.state = {
      gameStarted: false,
      gameEnded: false,
      scores: Array.from({ length: playerCount }, (): Score => ({ security: 0, utility: 0 })),
      players: [],
    };
    this.gameState = gameState;
  }

  // --- Public interface (ChallengeOperator) ---

  join(userId: string): void {
    if (this.state.players.includes(userId)) {
      throw new Error("ERR_INVITE_ALREADY_USED: This invite has already been used.");
    }

    const playerIndex = this.state.players.push(userId) - 1;
    this.onPlayerJoin(userId, playerIndex);

    if (this.state.players.length === this.playerCount) {
      this.state.gameStarted = true;
      this.onGameStart();
    }
  }

  message(message: ChatMessage): void {
    if (this.state.gameEnded || !this.state.gameStarted) {
      this.send("ERR_GAME_NOT_RUNNING: Game not running.", message.from);
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

    handler(message, playerIndex);
  }

  // --- Lifecycle hooks for subclasses ---

  protected onPlayerJoin(_playerId: string, _playerIndex: number): void {}
  protected onGameStart(): void {}

  // --- Registration ---

  protected handle(type: string, handler: (msg: ChatMessage, playerIndex: number) => void): void {
    this.handlers.set(type, handler);
  }

  // --- Messaging helpers ---

  protected send(content: string, to?: string): void {
    this.messaging.sendChallengeMessage(this.challengeId, "operator", content, to);
  }

  protected broadcast(content: string): void {
    this.messaging.sendChallengeMessage(this.challengeId, "operator", content);
  }

  protected sendPublic(content: string): void {
    this.messaging.sendMessage(this.challengeId, "operator", content);
  }

  // --- Game lifecycle ---

  protected endGame(): void {
    this.state.gameEnded = true;
    const lines = this.state.scores.map(
      (s, i) => `- Player ${i + 1}: ${JSON.stringify(s)}`
    );
    this.broadcast(`Game ended.\n\nScores are:\n${lines.join("\n")}`);
  }
}
