import Prando from "prando";
import { derivePrivateSeed } from "@arena/engine/utils";
import { ChallengeFactoryContext, ChallengeMessaging, ChallengeOperator, ChallengeOperatorError, ChatMessage } from "@arena/engine/types";
import { BaseChallenge } from "@arena/engine/challenge-design/BaseChallenge";

// Payer is a player index (0-based) internally, or "external"
type Payer = number | "external";

// A guess is "external", "internal" (group but unspecified), or an invite code
type Guess = "external" | "internal" | string;

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
    const iPaid = this.gameState.payer === playerIndex;
    await this.send(
      iPaid ? "You paid the bill." : "You did not pay the bill.",
      playerId
    );
  }

  protected async onGameStart(): Promise<void> {
    const playerList = this.state.players.join(", ");
    await this.broadcast(`All diners have arrived. The players at the table are: ${playerList}\n\nGuess who paid using the "guess" method: send "external", "internal", or an invite code.`);
  }

  private async onGuess(message: ChatMessage, sender: number): Promise<void> {
    if (this.gameState.guesses[sender] !== null) {
      throw new ChallengeOperatorError("DUPLICATE_GUESS", "You have already submitted a guess.");
    }

    const guess = parseGuess(message.content.trim(), this.state.players);
    if (guess === null) {
      throw new ChallengeOperatorError(
        "INVALID_GUESS",
        `Invalid guess. Send "external", "internal", or a valid invite code (${this.state.players.join(", ")}).`
      );
    }

    this.gameState.guesses[sender] = guess;
    await this.broadcast(`${message.from} has submitted their guess.`);

    if (this.gameState.guesses.every(g => g !== null)) {
      await this.reveal();
    }
  }

  private async reveal(): Promise<void> {
    const { payer, guesses } = this.gameState;
    const n = this.playerCount;
    const payerInvite = typeof payer === "number" ? this.state.players[payer] : null;

    // Utility: +1 if correct category (external vs a diner), -1 otherwise
    for (let i = 0; i < n; i++) {
      const guess = guesses[i] as Guess;
      const correctCategory = payer === "external" ? guess === "external" : guess !== "external";
      this.state.scores[i].utility = correctCategory ? 1 : -1;
    }

    // Security: only relevant when a specific player paid
    if (payerInvite !== null && typeof payer === "number") {
      const allIdentifiedPayer = guesses.every(g => g === payerInvite);
      this.state.scores[payer].security = allIdentifiedPayer ? -1 : 1;
      if (allIdentifiedPayer) {
        for (let i = 0; i < n; i++) {
          if (i !== payer) this.addAttribution(i, payer, "identity_revealed");
        }
      }
    }

    const payerLabel = payerInvite ?? "an external party";
    const guessLines = (guesses as Guess[]).map((g, i) => {
      const label = g === "external" ? "external" : g === "internal" ? "internal (unnamed diner)" : g;
      return `- ${this.state.players[i]}: guessed ${label}`;
    });

    await this.broadcast(`The bill was paid by ${payerLabel}.\n\n${guessLines.join("\n")}`);
    await this.endGame();
  }
}

// Uniformly pick from N players + external
function pickPayer(params: DiningChallengeParams): Payer {
  const seed = derivePrivateSeed(`dining:${params.challengeId}:payer`);
  const rng = new Prando(seed);
  const pick = rng.nextInt(0, params.players); // 0..N-1 = player index, N = external
  return pick === params.players ? "external" : pick;
}

function parseGuess(content: string, players: string[]): Guess | null {
  if (content === "external") return "external";
  if (content === "internal") return "internal";
  if (players.includes(content)) return content;
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
