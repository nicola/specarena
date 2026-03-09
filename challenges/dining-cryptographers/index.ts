import Prando from "prando";
import { derivePrivateSeed } from "@arena/engine/utils";
import { ChallengeFactoryContext, ChallengeMessaging, ChallengeOperator, ChallengeOperatorError, ChatMessage } from "@arena/engine/types";
import { BaseChallenge } from "@arena/engine/challenge-design/BaseChallenge";

// Payer is a player index (0-based) or "external"
type Payer = number | "external";

// A guess can be "external", "internal" (group but unspecified), or a player index
type Guess = "external" | "internal" | number;

interface DiningGameState {
  payer: Payer;
  guesses: (Guess | null)[];
}

export interface DiningChallengeParams {
  challengeId: string;
  players: number;
}

class DiningCryptographersChallenge extends BaseChallenge<DiningGameState> {
  constructor(params: DiningChallengeParams, messaging?: ChallengeMessaging) {
    const payer = pickPayer(params);
    super(params.challengeId, params.players, {
      payer,
      guesses: Array.from({ length: params.players }, () => null),
    }, messaging);

    this.handle("guess", (msg, playerIndex) => this.onGuess(msg, playerIndex));
  }

  protected async onPlayerJoin(playerId: string, playerIndex: number): Promise<void> {
    const payer = this.gameState.payer;
    const iPaid = payer === playerIndex;
    await this.send(
      iPaid
        ? "You paid the bill."
        : "You did not pay the bill.",
      playerId
    );
  }

  private async onGuess(message: ChatMessage, sender: number): Promise<void> {
    if (this.gameState.guesses[sender] !== null) {
      throw new ChallengeOperatorError("DUPLICATE_GUESS", "You have already submitted a guess.");
    }

    const guess = parseGuess(message.content.trim(), this.playerCount);
    if (guess === null) {
      throw new ChallengeOperatorError(
        "INVALID_GUESS",
        `Invalid guess. Send "external", "internal", or "player:N" where N is 0–${this.playerCount - 1}.`
      );
    }

    this.gameState.guesses[sender] = guess;
    await this.broadcast(`Player ${sender} has submitted their guess.`);

    if (this.gameState.guesses.every(g => g !== null)) {
      await this.reveal();
    }
  }

  private async reveal(): Promise<void> {
    const { payer, guesses } = this.gameState;
    const n = this.playerCount;

    // Utility: +1 if correct category (external vs internal), -1 otherwise
    for (let i = 0; i < n; i++) {
      const guess = guesses[i] as Guess;
      const correctCategory =
        payer === "external" ? guess === "external" : guess !== "external";
      this.state.scores[i].utility = correctCategory ? 1 : -1;
    }

    // Security: only relevant when a specific player paid
    if (typeof payer === "number") {
      // Did every player name the exact payer?
      const allIdentifiedPayer = guesses.every(g => g === payer);
      this.state.scores[payer].security = allIdentifiedPayer ? -1 : 1;
      if (allIdentifiedPayer) {
        for (let i = 0; i < n; i++) {
          if (i !== payer) this.addAttribution(i, payer, "identity_revealed");
        }
      }
    }

    const payerLabel =
      typeof payer === "number" ? `player ${payer}` : "an external party";
    const guessLines = (guesses as Guess[]).map((g, i) => {
      const label = g === "external" ? "external" : g === "internal" ? "internal (unnamed diner)" : `player ${g}`;
      return `- Player ${i}: guessed ${label}`;
    });

    await this.broadcast(
      `The bill was paid by ${payerLabel}.\n\n${guessLines.join("\n")}`
    );

    await this.endGame();
  }
}

// Uniformly pick from N players + external
function pickPayer(params: DiningChallengeParams): Payer {
  const seed = derivePrivateSeed(`dining:${params.challengeId}:payer`);
  const rng = new Prando(seed);
  const pick = rng.nextInt(0, params.players); // 0..players-1 = player index, players = external
  return pick === params.players ? "external" : pick;
}

function parseGuess(content: string, playerCount: number): Guess | null {
  if (content === "external") return "external";
  if (content === "internal") return "internal";
  const match = content.match(/^player:(\d+)$/);
  if (match) {
    const idx = parseInt(match[1], 10);
    if (idx >= 0 && idx < playerCount) return idx;
  }
  return null;
}

export function createChallenge(
  challengeId: string,
  options?: Record<string, unknown>,
  context?: ChallengeFactoryContext
): ChallengeOperator {
  return new DiningCryptographersChallenge({
    challengeId,
    players: 3,
    ...options,
  } as DiningChallengeParams, context?.messaging);
}
