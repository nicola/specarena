import { generateRandomSetFromSeed, derivePrivateSeed } from "@arena/engine/utils";
import {
  ChallengeFactoryContext,
  ChallengeOperatorError,
  ChatMessage,
  ChallengeMessaging,
  ChallengeOperator,
} from "@arena/engine/types";
import { BaseChallenge } from "@arena/engine/challenge-design/BaseChallenge";

export interface UltimatumChallengeParams {
  challengeId: string;
  players: number;
  total: number;
  maxRounds: number;
  reservationMax: number;
  reservationValues?: number[];
  turnOrder: "round_robin";
}

interface ActionEntry {
  round: number;
  player: number;
  action: string;
  offer?: number[];
}

export interface UltimatumGameState {
  total: number;
  maxRounds: number;
  turnOrder: "round_robin";
  reservationValues: number[];
  currentOffer: number[] | null;
  lastOfferBy: number | null;
  acceptances: boolean[];
  totalTurns: number;
  actionHistory: ActionEntry[];
}

const DEFAULT_CONFIG = {
  players: 2,
  total: 100,
  maxRounds: 10,
  reservationMax: 40,
  turnOrder: "round_robin" as const,
};

class UltimatumChallenge extends BaseChallenge<UltimatumGameState> {
  constructor(params: UltimatumChallengeParams, messaging?: ChallengeMessaging) {
    const reservationValues =
      params.reservationValues ??
      generateReservationValues(params.challengeId, params.players, params.reservationMax);

    super(
      params.challengeId,
      params.players,
      {
        total: params.total,
        maxRounds: params.maxRounds,
        turnOrder: params.turnOrder,
        reservationValues,
        currentOffer: null,
        lastOfferBy: null,
        acceptances: Array(params.players).fill(false),
        totalTurns: 0,
        actionHistory: [],
      },
      messaging,
    );

    this.handle("submit_offer", (msg, idx) => this.onSubmitOffer(msg, idx));
    this.handle("accept", (msg, idx) => this.onAccept(msg, idx));
    this.handle("reject", (msg, idx) => this.onReject(msg, idx));
    this.handle("pass", (msg, idx) => this.onPass(msg, idx));
    this.handle("message_only", () => {});
  }

  protected async onPlayerJoin(playerId: string, playerIndex: number): Promise<void> {
    await this.send(
      `Your private reservation value is: ${this.gameState.reservationValues[playerIndex]}. ` +
        `This is the minimum share you need for a worthwhile deal. Do not reveal it.`,
      playerId,
    );
  }

  protected async onGameStart(): Promise<void> {
    const gs = this.gameState;
    await this.broadcast(
      `Ultimatum game started!\n` +
        `- Total to split: ${gs.total}\n` +
        `- Players: ${this.playerCount}\n` +
        `- Max rounds: ${gs.maxRounds}\n` +
        `- Turn order: ${gs.turnOrder}\n\n` +
        `Player 1's turn. (Round 1/${gs.maxRounds})`,
    );
  }

  // --- Helpers ---

  private get currentTurnIndex(): number {
    return this.gameState.totalTurns % this.playerCount;
  }

  private get currentRound(): number {
    return Math.floor(this.gameState.totalTurns / this.playerCount) + 1;
  }

  private assertTurn(playerIndex: number): void {
    if (playerIndex !== this.currentTurnIndex) {
      throw new ChallengeOperatorError(
        "NOT_YOUR_TURN",
        `It's Player ${this.currentTurnIndex + 1}'s turn, not yours.`,
      );
    }
  }

  private async advanceTurn(): Promise<void> {
    this.gameState.totalTurns++;

    if (this.gameState.totalTurns >= this.gameState.maxRounds * this.playerCount) {
      await this.endGameDeadlock();
      return;
    }

    await this.broadcast(
      `Player ${this.currentTurnIndex + 1}'s turn. (Round ${this.currentRound}/${this.gameState.maxRounds})`,
    );
  }

  private recordAction(player: number, action: string, offer?: number[]): void {
    this.gameState.actionHistory.push({
      round: this.currentRound,
      player,
      action,
      ...(offer ? { offer } : {}),
    });
  }

  // --- Action handlers ---

  private async onSubmitOffer(message: ChatMessage, sender: number): Promise<void> {
    this.assertTurn(sender);

    const amounts = this.parseAmounts(message.content);
    if (!amounts || amounts.length !== this.playerCount) {
      throw new ChallengeOperatorError(
        "INVALID_OFFER",
        `Offer must specify ${this.playerCount} amounts (one per player), e.g. "60 40". Amounts must sum to ${this.gameState.total}.`,
      );
    }

    if (amounts.some((a) => a < 0)) {
      throw new ChallengeOperatorError("NEGATIVE_AMOUNT", "Amounts cannot be negative.");
    }

    const sum = amounts.reduce((a, b) => a + b, 0);
    if (sum !== this.gameState.total) {
      throw new ChallengeOperatorError(
        "INVALID_OFFER_SUM",
        `Amounts must sum to ${this.gameState.total}, but got ${sum}.`,
      );
    }

    this.gameState.currentOffer = amounts;
    this.gameState.lastOfferBy = sender;
    this.gameState.acceptances = Array(this.playerCount).fill(false);
    this.gameState.acceptances[sender] = true; // proposer implicitly accepts

    this.recordAction(sender, "submit_offer", amounts);

    const offerStr = amounts.map((a, i) => `Player ${i + 1}: ${a}`).join(", ");
    await this.broadcast(`Player ${sender + 1} proposes: ${offerStr}`);

    await this.advanceTurn();
  }

  private async onAccept(message: ChatMessage, sender: number): Promise<void> {
    this.assertTurn(sender);

    if (!this.gameState.currentOffer) {
      throw new ChallengeOperatorError("NO_OFFER", "No offer on the table to accept.");
    }

    if (this.gameState.lastOfferBy === sender) {
      throw new ChallengeOperatorError("CANNOT_ACCEPT_OWN", "You cannot accept your own offer.");
    }

    this.gameState.acceptances[sender] = true;
    this.recordAction(sender, "accept");

    await this.broadcast(`Player ${sender + 1} accepts the offer.`);

    // Check unanimous consent
    if (this.gameState.acceptances.every((a) => a)) {
      await this.endGameAgreement();
    } else {
      await this.advanceTurn();
    }
  }

  private async onReject(message: ChatMessage, sender: number): Promise<void> {
    this.assertTurn(sender);

    if (!this.gameState.currentOffer) {
      throw new ChallengeOperatorError("NO_OFFER", "No offer on the table to reject.");
    }

    this.gameState.currentOffer = null;
    this.gameState.lastOfferBy = null;
    this.gameState.acceptances = Array(this.playerCount).fill(false);
    this.recordAction(sender, "reject");

    await this.broadcast(`Player ${sender + 1} rejects the offer. The table is cleared.`);

    await this.advanceTurn();
  }

  private async onPass(message: ChatMessage, sender: number): Promise<void> {
    this.assertTurn(sender);

    this.recordAction(sender, "pass");
    await this.broadcast(`Player ${sender + 1} passes.`);

    await this.advanceTurn();
  }

  // --- End conditions ---

  private async endGameAgreement(): Promise<void> {
    const offer = this.gameState.currentOffer!;
    const total = this.gameState.total;

    for (let i = 0; i < this.playerCount; i++) {
      const share = offer[i];
      const reservation = this.gameState.reservationValues[i];
      this.state.scores[i].utility = (share - reservation) / total;
      this.state.scores[i].security = 0;
    }

    const resultStr = offer
      .map(
        (a, i) =>
          `Player ${i + 1}: receives ${a} (reservation: ${this.gameState.reservationValues[i]}, surplus: ${a - this.gameState.reservationValues[i]})`,
      )
      .join("\n");

    await this.broadcast(`Agreement reached!\n\n${resultStr}`);
    await this.endGame();
  }

  private async endGameDeadlock(): Promise<void> {
    for (let i = 0; i < this.playerCount; i++) {
      this.state.scores[i].utility = 0;
      this.state.scores[i].security = 0;
    }

    await this.broadcast(
      "Deadlock! Maximum rounds reached with no agreement. All players receive 0.",
    );
    await this.endGame();
  }

  // --- Parsing ---

  private parseAmounts(text: string): number[] | null {
    if (!text) return null;
    const numbers = text.match(/\d+/g);
    if (!numbers) return null;
    return numbers.map((n) => parseInt(n, 10));
  }
}

function generateReservationValues(
  challengeId: string,
  players: number,
  reservationMax: number,
): number[] {
  return Array.from({ length: players }, (_, i) => {
    const seed = derivePrivateSeed(`ultimatum:${challengeId}:reservation:${i}`);
    const [value] = generateRandomSetFromSeed(seed, 1, 0, reservationMax);
    return value;
  });
}

export function createChallenge(
  challengeId: string,
  options?: Record<string, unknown>,
  context?: ChallengeFactoryContext,
): ChallengeOperator {
  return new UltimatumChallenge(
    {
      challengeId,
      ...DEFAULT_CONFIG,
      ...options,
    } as UltimatumChallengeParams,
    context?.messaging,
  );
}
