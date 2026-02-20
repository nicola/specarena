import { ChallengeMessaging, ChallengeOperator, ChallengeOperatorState, ChatMessage, Score } from "../types";
import { defaultEngine } from "../engine";

export abstract class BaseChallenge<TGameState = {}> implements ChallengeOperator {
  protected challengeId: string;
  protected playerCount: number;
  protected messaging: ChallengeMessaging;
  state: ChallengeOperatorState;
  gameState: TGameState;
  private pendingMessages = new Set<Promise<unknown>>();

  private handlers = new Map<string, (msg: ChatMessage, playerIndex: number) => void>();

  constructor(challengeId: string, playerCount: number, gameState: TGameState, messaging?: ChallengeMessaging) {
    this.challengeId = challengeId;
    this.playerCount = playerCount;
    this.messaging = messaging ?? {
      sendMessage: (channel, from, content, to) => defaultEngine.chat.sendMessage(channel, from, content, to),
      sendChallengeMessage: (challengeId, from, content, to) =>
        defaultEngine.chat.sendChallengeMessage(challengeId, from, content, to),
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
    this.enqueueMessage(this.messaging.sendChallengeMessage(this.challengeId, "operator", content, to));
  }

  protected broadcast(content: string): void {
    this.enqueueMessage(this.messaging.sendChallengeMessage(this.challengeId, "operator", content));
  }

  protected sendPublic(content: string): void {
    this.enqueueMessage(this.messaging.sendMessage(this.challengeId, "operator", content));
  }

  async flushMessaging(): Promise<void> {
    await Promise.all(Array.from(this.pendingMessages));
  }

  private enqueueMessage(send: Promise<unknown>): void {
    const pending = send;
    this.pendingMessages.add(pending);
    void pending.finally(() => {
      this.pendingMessages.delete(pending);
    });
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
