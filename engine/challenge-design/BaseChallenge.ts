import { ChallengeMessaging, ChallengeOperator, ChallengeOperatorState, ChatMessage, Score } from "../types";
import { defaultChatEngine } from "../chat/ChatEngine";

export abstract class BaseChallenge<TGameState = {}> implements ChallengeOperator {
  protected challengeId: string;
  protected playerCount: number;
  protected messaging: ChallengeMessaging;
  state: ChallengeOperatorState;
  gameState: TGameState;
  private handlers = new Map<string, (msg: ChatMessage, playerIndex: number) => void | Promise<void>>();

  constructor(challengeId: string, playerCount: number, gameState: TGameState, messaging?: ChallengeMessaging) {
    this.challengeId = challengeId;
    this.playerCount = playerCount;
    this.messaging = messaging ?? {
      sendMessage: (channel, from, content, to) => defaultChatEngine.sendMessage(channel, from, content, to),
      sendChallengeMessage: (challengeId, from, content, to) =>
        defaultChatEngine.sendChallengeMessage(challengeId, from, content, to),
    };
    this.state = {
      gameStarted: false,
      gameEnded: false,
      scores: Array.from({ length: playerCount }, (): Score => ({ security: 0, utility: 0 })),
      players: [],
    };
    this.gameState = gameState;
  }

  // --- Public interface (ChallengeOperator) ---

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

  protected handle(type: string, handler: (msg: ChatMessage, playerIndex: number) => void | Promise<void>): void {
    this.handlers.set(type, handler);
  }

  // --- Messaging helpers ---

  protected async send(content: string, to?: string): Promise<void> {
    await this.messaging.sendChallengeMessage(this.challengeId, "operator", content, to);
  }

  protected async broadcast(content: string): Promise<void> {
    await this.messaging.sendChallengeMessage(this.challengeId, "operator", content);
  }

  protected async sendPublic(content: string): Promise<void> {
    await this.messaging.sendMessage(this.challengeId, "operator", content);
  }

  // --- Game lifecycle ---

  protected async endGame(): Promise<void> {
    this.state.gameEnded = true;
    const lines = this.state.scores.map(
      (s, i) => `- Player ${i + 1}: ${JSON.stringify(s)}`
    );
    await this.broadcast(`Game ended.\n\nScores are:\n${lines.join("\n")}`);
  }
}
