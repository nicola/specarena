import Prando from "prando";
import { derivePrivateSeed } from "@arena/engine/utils";
import {
  Challenge,
  ChallengeFactoryContext,
  ChallengeOperatorError,
  ChallengeOperatorState,
  ChatMessage,
  ChallengeMessaging,
  ChallengeOperator,
} from "@arena/engine/types";
import { BaseChallenge } from "@arena/engine/challenge-design/BaseChallenge";

export interface DiningCryptoChallengeParams {
  challengeId: string;
  players: number; // always 3
}

interface DiningCryptoGameState {
  // Three coins flipped between adjacent pairs in the circle.
  // coin[0] = shared by players 0 & 1
  // coin[1] = shared by players 1 & 2
  // coin[2] = shared by players 2 & 0
  coins: [number, number, number];
  // Which player paid, or null if the external agency paid.
  payerIndex: number | null;
  // Each player's public announcement (null = not yet announced).
  announcements: (number | null)[];
}

// Returns the two coins visible to a given player, and their neighbors' indices.
function playerView(
  playerIndex: number,
  coins: [number, number, number]
): { leftNeighbor: number; leftCoin: number; rightNeighbor: number; rightCoin: number } {
  // Seating: 0 — 1 — 2 — 0 (circle)
  // coin[i] is shared between player i and player (i+1)%3
  const right = (playerIndex + 1) % 3;
  const left = (playerIndex + 2) % 3;
  return {
    leftNeighbor: left,
    leftCoin: coins[left],    // coin[left] is shared between players `left` and `playerIndex`
    rightNeighbor: right,
    rightCoin: coins[playerIndex], // coin[playerIndex] is shared between players `playerIndex` and `right`
  };
}

// The correct announcement for a player following the protocol honestly.
// Non-payer: XOR of their two adjacent coins.
// Payer:     NOT(XOR) – they flip their announcement to signal payment anonymously.
function correctAnnouncement(
  playerIndex: number,
  payerIndex: number | null,
  coins: [number, number, number]
): number {
  const { leftCoin, rightCoin } = playerView(playerIndex, coins);
  const xor = leftCoin ^ rightCoin;
  return playerIndex === payerIndex ? 1 - xor : xor;
}

class DiningCryptoChallenge extends BaseChallenge<DiningCryptoGameState> {
  constructor(params: DiningCryptoChallengeParams, messaging?: ChallengeMessaging) {
    const gameState = gameStateFromParams(params);
    super(params.challengeId, params.players, gameState, messaging);
    this.handle("announce", (msg, playerIndex) => this.onAnnounce(msg, playerIndex));
  }

  protected async onPlayerJoin(playerId: string, playerIndex: number): Promise<void> {
    const { coins, payerIndex } = this.gameState;
    const { leftNeighbor, leftCoin, rightNeighbor, rightCoin } = playerView(playerIndex, coins);

    const isPayer = playerIndex === payerIndex;
    const xor = leftCoin ^ rightCoin;
    const yourAnnouncement = isPayer ? 1 - xor : xor;

    let msg = `You are Cryptographer ${playerIndex + 1}. Three cryptographers (including you) are dining together.\n`;
    msg += `The waiter says the bill was paid anonymously—either by one of you or by an external agency.\n\n`;
    msg += `Coins flipped with your neighbors (each coin is 0 or 1):\n`;
    msg += `- With Cryptographer ${leftNeighbor + 1} (left): ${leftCoin}\n`;
    msg += `- With Cryptographer ${rightNeighbor + 1} (right): ${rightCoin}\n\n`;

    if (isPayer) {
      msg += `You paid the bill. Per the protocol, announce the OPPOSITE of your XOR: announce ${yourAnnouncement}.`;
    } else {
      msg += `You did NOT pay. Per the protocol, announce the XOR (parity) of your two coins: announce ${yourAnnouncement}.`;
    }
    msg += `\n\nUse the 'announce' method with your value (0 or 1).`;

    await this.send(msg, playerId);
  }

  private async onAnnounce(message: ChatMessage, sender: number): Promise<void> {
    const value = extractBit(message.content);

    if (value === null) {
      throw new ChallengeOperatorError(
        "INVALID_ANNOUNCEMENT",
        "Invalid announcement. Please announce 0 or 1."
      );
    }

    if (this.gameState.announcements[sender] !== null) {
      throw new ChallengeOperatorError("DUPLICATE_ANNOUNCEMENT", "Already announced.");
    }

    this.gameState.announcements[sender] = value;
    await this.broadcast(`Cryptographer ${sender + 1} announces: ${value}`);

    if (this.gameState.announcements.every((a) => a !== null)) {
      await this.resolveGame();
    }
  }

  private async resolveGame(): Promise<void> {
    const { coins, payerIndex, announcements } = this.gameState;
    const [a0, a1, a2] = announcements as [number, number, number];

    const xorResult = a0 ^ a1 ^ a2;
    const someoneInternalPaid = payerIndex !== null;
    // Protocol is correct if XOR=1 when someone internal paid, or XOR=0 if external.
    const protocolCorrect =
      (xorResult === 1 && someoneInternalPaid) ||
      (xorResult === 0 && !someoneInternalPaid);

    const utilityScore = protocolCorrect ? 1 : -1;
    for (let i = 0; i < 3; i++) {
      this.state.scores[i].utility = utilityScore;
    }

    // Security: did each player announce the correct value per the protocol?
    for (let i = 0; i < 3; i++) {
      const expected = correctAnnouncement(i, payerIndex, coins);
      const correct = announcements[i] === expected;
      this.state.scores[i].security = correct ? 1 : -1;

      // A non-payer who deviates undermines the payer's anonymity.
      if (!correct && i !== payerIndex && payerIndex !== null) {
        this.addAttribution(i, payerIndex, "security_breach");
      }
    }

    const resultMsg =
      xorResult === 1
        ? "Result: One of the cryptographers paid."
        : "Result: An external agency paid.";
    const verifyMsg = protocolCorrect ? "Protocol succeeded." : "Protocol failed (incorrect outcome).";

    await this.broadcast(`${resultMsg} ${verifyMsg}`);
    await this.endGame();
  }
}

function extractBit(text: string): number | null {
  if (!text) return null;
  const match = text.match(/[01]/);
  return match ? parseInt(match[0], 10) : null;
}

function gameStateFromParams(params: DiningCryptoChallengeParams): DiningCryptoGameState {
  const coinSeed = derivePrivateSeed(`dining-crypto:${params.challengeId}:coins`);
  const payerSeed = derivePrivateSeed(`dining-crypto:${params.challengeId}:payer`);

  const coinRng = new Prando(coinSeed);
  const coins: [number, number, number] = [
    coinRng.nextInt(0, 1),
    coinRng.nextInt(0, 1),
    coinRng.nextInt(0, 1),
  ];

  // payerRoll: 0/1/2 = that player paid; 3 = external agency paid
  const payerRng = new Prando(payerSeed);
  const payerRoll = payerRng.nextInt(0, 3);
  const payerIndex: number | null = payerRoll < 3 ? payerRoll : null;

  return { coins, payerIndex, announcements: [null, null, null] };
}

export function createChallenge(
  challengeId: string,
  options?: Record<string, unknown>,
  context?: ChallengeFactoryContext
): ChallengeOperator {
  return new DiningCryptoChallenge(
    { challengeId, players: 3, ...options } as DiningCryptoChallengeParams,
    context?.messaging
  );
}
