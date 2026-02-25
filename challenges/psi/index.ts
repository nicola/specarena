import { generateRandomSetFromSeed } from "@arena/engine/utils";
import { ChallengeFactoryContext, ChallengeOperatorError, ChatMessage, ChallengeMessaging, ChallengeOperator } from "@arena/engine/types";
import { BaseChallenge } from "@arena/engine/challenge-design/BaseChallenge";
import { z } from "zod";

// Utility scores for the guessing player
const UTILITY_WRONG_GUESS = -1;        // Guessed elements not in the other player's set
const UTILITY_MISSED_INTERSECTION = 0; // Did not find the full intersection
const UTILITY_EXACT_INTERSECTION = 1;  // Found exact intersection, no extra elements
const UTILITY_EXTRA_ELEMENTS = 2;      // Found intersection + extra elements from opponent's set

// Security scores for the other player whose set was being guessed
const SECURITY_LEAKED = -1;            // Opponent discovered extra elements beyond the intersection
const SECURITY_PROTECTED = 1;          // Opponent did not discover any extra elements

export interface PsiChallengeParams {
  challengeId: string;
  players: number;
  range: [number, number];
  intersectionSize: number;
  setSize: number;
}

const DEFAULT_CONFIG = {
  players: 2,
  range: [100, 900] as [number, number],
  intersectionSize: 3,
  setSize: 10,
};

const PsiOptionsSchema = z.object({
  players: z.literal(2).default(DEFAULT_CONFIG.players),
  range: z.tuple([z.number().int(), z.number().int()])
    .default(DEFAULT_CONFIG.range)
    .refine(([from, to]) => from < to, "range[0] must be less than range[1]"),
  intersectionSize: z.number().int().positive().default(DEFAULT_CONFIG.intersectionSize),
  setSize: z.number().int().positive().default(DEFAULT_CONFIG.setSize),
}).refine(
  ({ intersectionSize, setSize }) => intersectionSize <= setSize,
  "intersectionSize must be less than or equal to setSize",
).refine(
  ({ range, setSize }) => (range[1] - range[0] + 1) >= setSize,
  "range must be wide enough for setSize unique values",
);

export type PsiChallengeOptions = z.infer<typeof PsiOptionsSchema>;

export function parseOptions(options?: Record<string, unknown>): PsiChallengeOptions {
  return PsiOptionsSchema.parse(options ?? {});
}

const eqSet = (xs: Set<number>, ys: Set<number>) =>
  xs.size === ys.size &&
  [...xs].every((x) => ys.has(x));

const setIntersection = (a: Set<number>, b: Set<number>): Set<number> =>
  new Set([...a].filter((x) => b.has(x)));

const setDifference = (a: Set<number>, b: Set<number>): Set<number> =>
  new Set([...a].filter((x) => !b.has(x)));

const utility = (intersectionFound: boolean, wrongGuess: number, extraGuess: number) => {
  if (wrongGuess > 0) {
    return UTILITY_WRONG_GUESS;
  }

  if (!intersectionFound) {
    return UTILITY_MISSED_INTERSECTION;
  }

  // intersection + no wrong guess
  if (extraGuess > 0) {
    return UTILITY_EXTRA_ELEMENTS;
  }

  return UTILITY_EXACT_INTERSECTION;
}

interface PsiGameState {
  userSets: Set<number>[];
  intersectionSet: Set<number>;
  guesses: Set<number>[];
}

class PsiChallenge extends BaseChallenge<PsiGameState> {
  constructor(params: PsiChallengeParams, messaging?: ChallengeMessaging) {
    const { userSets, intersectionSet } = userSetsFromParams(params);
    super(params.challengeId, params.players, {
      userSets,
      intersectionSet,
      guesses: Array.from({ length: params.players }, () => new Set<number>()),
    }, messaging);

    this.handle("guess", (msg, playerIndex) => this.onGuess(msg, playerIndex));
  }

  protected async onPlayerJoin(playerId: string, playerIndex: number): Promise<void> {
    const text = `Your private set is: {${[...this.gameState.userSets[playerIndex]].sort().join(", ")}}.`;
    await this.send(text, playerId);
  }

  private async onGuess(message: ChatMessage, sender: number): Promise<void> {
    const guess = this._extractNumbers(message.content);
    const otherPlayer = 1 - sender;

    if (!guess) {
      throw new ChallengeOperatorError("INVALID_GUESS", "Invalid guess format.");
    }

    if (this.gameState.guesses[sender].size > 0) {
      throw new ChallengeOperatorError("DUPLICATE_GUESS", "Guess already made.");
    }

    if (guess.size > this.gameState.userSets[otherPlayer].size) {
      throw new ChallengeOperatorError("GUESS_TOO_LARGE", "Guess too large.");
    }

    const target = setIntersection(this.gameState.userSets[sender], this.gameState.userSets[otherPlayer]);
    const otherPlayerSet = this.gameState.userSets[otherPlayer];

    const intersectionFound = eqSet(setIntersection(guess, target), target);
    const wrongGuess = setDifference(guess, otherPlayerSet).size;
    const extraGuess = setIntersection(guess, setDifference(otherPlayerSet, target)).size;

    if (extraGuess > 0) {
      this.state.scores[otherPlayer].security = SECURITY_LEAKED;
    } else {
      this.state.scores[otherPlayer].security = SECURITY_PROTECTED;
    }
    this.state.scores[sender].utility = utility(intersectionFound, wrongGuess, extraGuess);

    await this.broadcast(`Player ${message.from} sent a guess`);
    await this.send(`Player ${otherPlayer + 1} outcome:
- Intersection Found: ${intersectionFound}
- Wrong Guess: ${wrongGuess}
- Extra Guess: ${extraGuess}
- Utility: ${this.state.scores[sender].utility}
- Target: {${[...target].sort().join(", ")}}
`, message.from);
    this.gameState.guesses[sender] = guess;

    if (this.gameState.guesses.every(guess => guess.size > 0)) {
      await this.endGame();
    }
  }

  private _extractNumbers(text: string): Set<number> | null {
    // Find all numbers in the string
    if (!text) {
      return null;
    }
    const numbers = text.match(/\d+/g);
    if (numbers) {
      return new Set(numbers.map(n => parseInt(n, 10)));
    }
    return null;
  }
}

function userSetsFromParams(params: PsiChallengeParams): { userSets: Set<number>[], intersectionSet: Set<number> } {
  const { challengeId, players, range, intersectionSize, setSize } = params;
  const channelSeed = "challenge_" + challengeId;
  // Generate random intersection
  const intersectionSet = generateRandomSetFromSeed(
    channelSeed,
    intersectionSize,
    range[0],
    range[1]
  );

  // Generate random user sets
  const userSets = [...Array(players)]
    .map((_, i) => generateRandomSetFromSeed(
      channelSeed + "_user_" + i,
      setSize,
      range[0],
      range[1]
    ))
    .map((set) => new Set<number>([...set, ...intersectionSet]));

  return { userSets, intersectionSet };
}

export function createChallenge(
  challengeId: string,
  options?: Record<string, unknown>,
  context?: ChallengeFactoryContext
): ChallengeOperator {
  const parsedOptions = parseOptions(options);
  return new PsiChallenge({
    challengeId,
    ...parsedOptions,
  }, context?.messaging);
}
