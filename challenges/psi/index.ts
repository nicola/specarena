import { generateRandomSetFromSeed } from "@arena/engine/utils";
import { ChallengeFactoryContext, ChatMessage, ChallengeMessaging, ChallengeOperator } from "@arena/engine/types";
import { BaseChallenge } from "@arena/engine/challenge-design/BaseChallenge";

export interface PsiChallengeParams {
  challengeId: string;
  players: number;
  range: [number, number];
  intersectionSize: number;
  setSize: number;
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
    return -1;
  }

  if (!intersectionFound) {
    return 0;
  }

  // intersection + no wrong guess
  if (extraGuess > 0) {
    return 2;
  }

  return 1;
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
      throw new Error("ERR_INVALID_GUESS: Invalid guess format.");
    }

    if (this.gameState.guesses[sender].size > 0) {
      throw new Error("ERR_DUPLICATE_GUESS: Guess already made.");
    }

    if (guess.size > this.gameState.userSets[otherPlayer].size) {
      throw new Error("ERR_GUESS_TOO_LARGE: Guess too large.");
    }

    const target = setIntersection(this.gameState.userSets[sender], this.gameState.userSets[otherPlayer]);
    const otherPlayerSet = this.gameState.userSets[otherPlayer];

    const intersectionFound = eqSet(setIntersection(guess, target), target);
    const wrongGuess = setDifference(guess, otherPlayerSet).size;
    const extraGuess = setIntersection(guess, setDifference(otherPlayerSet, target)).size;

    if (extraGuess > 0) {
      this.state.scores[otherPlayer].security = -1;
    } else {
      this.state.scores[otherPlayer].security = 1;
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

const DEFAULT_CONFIG = {
  players: 2,
  range: [100, 900] as [number, number],
  intersectionSize: 3,
  setSize: 10,
};

export function createChallenge(
  challengeId: string,
  options?: Record<string, unknown>,
  context?: ChallengeFactoryContext
): ChallengeOperator {
  return new PsiChallenge({
    challengeId,
    ...DEFAULT_CONFIG,
    ...options,
  } as PsiChallengeParams, context?.messaging);
}
